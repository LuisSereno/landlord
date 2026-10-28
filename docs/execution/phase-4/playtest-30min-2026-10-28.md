# Playtest de 30 minutos a 4× — informe de errores, rendimiento y mejoras

- **Fecha:** 2026-10-28
- **Build:** `apps/web/dist` de producción (Vite 8.3.4; `index-tRJ3W5J3.js`, 1 922,54 kB min / 493,51 kB gzip)
- **Commit base:** `01ebb5b` (`visual: tune street dressing for V.c.3-H`), con el árbol de trabajo de documentación de este informe
- **Semilla:** 1 · **Velocidad:** 4× (máxima) · **Duración:** 144 220 ticks = 30,0 min de simulación
- **Entorno:** Chromium headless (Playwright 1.64.1, `chrome-headless-shell`), SwiftShader (`--use-angle=swiftshader-webgl`), Linux x64, viewport 1600×1000
- **Partida:** 4 meses de juego (cierres en los ticks 36 000, 72 000, 108 000 y 144 000); termina el mes 5, día 1, 04:00
- **Evidencia local:** `artifacts/playtest-2026-10-28/` (capturas, `session.jsonl`, `perf.json`, `final-snapshot.json`, etc.). `artifacts/` está ignorado por Git; no se añaden binarios al repositorio.

---

## 1. Resumen ejecutivo

La partida se jugó a 4× con una estrategia de compra temprana de suelo, apalancamiento y
construcción de dos talleres y un patio. **El jugador gana claramente a la IA en operación**:
8/8 unidades ocupadas frente a 0/3, 1 506 u./mes de renta frente a 0 y 4 718 u. de caja frente a
49 u. La comparación de patrimonio contable también favorece al jugador (16 756 u. frente a
13 797 u., +2 959), aunque esa diferencia está artificialmente estrechada por dos defectos de
valoración: la acería destruida del rival sigue contabilizada a valor completo (5 200 u.) y su
inventario de acero (3 520 u.) no tiene sumidero de venta. Descontando ambos, el patrimonio
operativo del rival sería 5 077 u. y la ventaja del jugador 11 679 u.

La sesión **no produjo crashes, errores de página, errores de consola, peticiones fallidas ni
rechazos de comandos**. Los problemas encontrados son de diseño, información, equilibrio,
integridad de estado y rendimiento. Los cinco hallazgos que más afectan a una partida real son:

1. **El flujo de préstamos de la UI está roto.** Al pedir un préstamo, la proyección incluye el
   préstamo en estado `offered` dentro de `banking.loans`; el esquema del cliente sólo admite
   `active | delinquent | paid_off | defaulted`, la proyección entera se rechaza y la UI nunca
   muestra la oferta ni el botón «Aceptar oferta». El botón «Solicitar 600 u.» es un callejón sin
   salida. En la sesión se usaron comandos directos, por eso el síntoma no apareció en el HUD.
2. **No existe condición de victoria, derrota, puntuación ni cierre de sesión.** «Ganar a la
   máquina» no está definido por el producto; este informe tiene que construirse una métrica.
3. **El límite de capacidad de obra se puede saltar.** La UI permite iniciar más obras de las que
   caben en las dos cuadrillas porque `StartConstruction` sólo cuenta `crewCapacity` (siempre 0
   salvo que se use el comando legado `AllocateCrew`) y no reserva nada. En la sesión se crearon
   3 obras con 2 cuadrillas.
4. **Se puede vender una parcela que garantiza un préstamo.** `SellParcel` no comprueba préstamos
   ni ofertas y `AcceptLoanOffer` no revalida la garantía. La parcela queda sin dueño, el préstamo
   sigue vivo y el banco pagó la venta. Reproducido: caja 12 468 u., parcela de 800 u. sin dueño y
   préstamo de 600 u. activo.
5. **La política de mantenimiento es global.** El jugador decide el mantenimiento de todo el
   distrito, incluido el rival: al pasar a «diferido», la condición del taller rival bajó de 95 a
   90 y su backlog subió de 60 a 120 en un mes. La UI lo presenta como una decisión propia.

Además, el rendimiento de la escena en este entorno es pobre: la simulación mantiene 80 t/s, pero
el frame se queda en ~9 FPS (mediana 116,6 ms) **también a 1× y 2×**, con ~16 100 long tasks de
~96 ms y el proceso GPU software al ~366 % de CPU. El cuello es el rasterizado, no el Worker; hay
que repetir la medición en un navegador con GPU antes de declararlo un fallo universal, pero el
fallback software es inviable y la UI pierde ~31 de las 40 proyecciones/s que recibe.

---

## 2. Metodología

- **Partida real, no un banco de pruebas:** la sesión se ejecutó sobre el build de producción
  servido con `vite preview`, con el Worker real y la escena Phaser real.
- **Instrumentación:** lectura de la proyección autoritativa del Worker, `requestAnimationFrame`
  para intervalos de frame, `PerformanceObserver` para long tasks, memoria JS cada 5 s, muestras
  de tick cada 10 s, latencias de comandos, errores de página/consola y peticiones fallidas.
- **Comandos:** la UI se usó con clics reales sobre el mapa (hook `?cameraTest=1`) y los paneles.
  Para las operaciones repetitivas de la estrategia se usaron los mismos comandos de producto
  directamente contra el Worker (sin saltarse validaciones del motor); esto es equivalente a la
  acción de la UI salvo que evita esperas de render.
- **Rival:** la partida se decidió sólo con información pública. El snapshot completo
  (`SaveSnapshot`) se usó **después** para medir caja, deuda, inventario y edificios del rival,
  que la UI oculta deliberadamente.
- **Determinismo:** `createInitialState(1)` y un único flujo de comandos; la partida es
  reproducible en lo que respecta al motor. Las acciones de UI/automatización y los tiempos de
  render no forman parte del estado canónico.
- **Ventana:** 4 meses completos. No se extendió la partida para probar elecciones, subastas o
  impagos, que quedan fuera del horizonte de 30 min a 4×.

---

## 3. Resultado de la partida

### 3.1 Comparación final (cierre del mes 4, tick 144 028; último tick 144 220)

| Métrica | Jugador | Rival | Diferencia |
|---|---:|---:|---:|
| Caja | **4 718** | 49 | **+4 669** |
| Inventario (valor de mercado) | 0 | 3 520 (22 acero) | −3 520 |
| Suelo (parcelas) | 2 550 (3) | 1 638 (2) | +912 |
| Edificios (valor de catálogo) | 11 400 (3) | 9 190 (2) | +2 210 |
| Activos | **18 668** | 14 397 | **+4 271** |
| Deuda viva | 1 912 | 600 | −1 312 |
| **Patrimonio contable** | **16 756** | **13 797** | **+2 959** |
| Edificios operativos | 3 | 1 (+1 ruina) | +2 |
| Unidades ocupadas | **8/8** | 0/3 | **+8** |
| Renta mensual | **1 506** | 0 | **+1 506** |
| Contratos públicos | 1 adjudicado / 1 completado (100 u. netas) | 0 | +1 |
| Reputación (residentes / municipio / banca) | 3 / 8 / 2 | 0 / 0 / — | — |
| Retorno de patrimonio en 4 meses | **+39,6 %** (12 000 → 16 756) | +15,0 % (12 000 → 13 797) | +24,6 pp |

Lectura correcta de esta tabla:

- **La comparación contable infravalora al jugador.** El rival conserva una acería en estado
  `ruin` con condición 100 valorada en 5 200 u. y 22 unidades de acero (3 520 u.) que no puede
  vender. Su patrimonio operativo (taller operativo 3 990 + suelo 1 638 + caja 49 − deuda 600) es
  **5 077 u.**, no 13 797. La ventaja operativa del jugador sería **+11 679 u.**
- **La comparación operativa es la decisiva:** 8/8 vs 0/3 unidades, 1 506 vs 0 de renta y 4 718 vs
  49 de caja. El rival está en un estado de liquidez muerto: su última acción registrada es
  `reserve_liquidity` («No hay una acción válida que preserve la liquidez mínima»).
- **El jugador también gana en la métrica contable**, pero por un margen menor del que sugiere la
  operación. Sin una condición de victoria oficial, el veredicto es: **victoria operativa clara y
  victoria contable por 2 959 u.; victoria ajustada por valoración por 11 679 u.**
- La partida termina con el jugador pudiendo repagar los 1 912 u. de deuda y quedarse con 2 806 u.
  de caja; la renta mensual neta prevista es 1 506 − 351 = 1 155 u./mes.

### 3.2 Estrategia seguida

1. **Tick 0:** lobby de la ordenanza inicial «Programa de materiales locales» con 2 de influencia
   (probabilidad final 95 % por alineamiento del concejo; aprobada). Efecto: −20 % coste de obra,
   −10 % renta, vigente hasta el tick 216 000.
2. **Compra inmediata** de 3 solares baratos (800 industrial, 850 industrial, 900 residencial) antes
   de que la IA actuara en el día 1.
3. **3 préstamos** con garantía de las 3 parcelas: 600 + 637 + 675 = 1 912 u. a 12 meses, 9 % anual.
4. **Construcción** de 2 talleres y 1 patio; compra de materiales intercalada para no superar la
   capacidad de almacén (40). Un macroevento de materiales redujo el precio de compra un 20 %
   adicional al inicio (cemento 72, ladrillo 44, acero 128 en vez de 90/55/160).
5. **Gestor de vacantes** activado; asignación manual de los inquilinos disponibles en cada hueco.
6. **Mes 2:** investigación de caja del rival (150 u.), seguro `fire_basic` en un taller (25 u./mes)
   y guardado/carga para verificar persistencia.
7. **Mes 2–3:** puja de 100 u. en el contrato público (presupuesto 420), cancelación del seguro y
   sabotaje físico de la acería rival con el enforcer.
8. **Cierre:** 8/8 unidades, contrato completado y 4 718 u. de caja. No se construyó un cuarto
   edificio: con los precios y el horizonte de 4 meses, la inversión tardía no se amortiza (ver
   §4.2, P1-2).

### 3.3 Cronología

| Hito | Tick | Fecha de juego | Caja | Patrimonio | Edificios propios | Ocupadas | Rival (edificios/ocupadas) |
|---|---:|---|---:|---:|---:|---:|---|
| Inicio de sesión (día 4) | 4 228 | Mes 1, día 4 | 587 | **1 225** | 0 (3 obras) | 0 | 2 / 0 |
| Cierre mes 1 | 36 024 | Mes 2, día 1 | 1 193 | 13 231 | 3 | 4/8 | 2 / 0 |
| Cierre mes 2 | 72 012 | Mes 3, día 1 | 2 056 | 14 094 | 3 | 6/8 | 2 / 0 |
| Cierre mes 3 | 108 080 | Mes 4, día 1 | 3 202 | 15 240 | 3 | 7/8 | 2 / 0 |
| Cierre mes 4 | 144 028 | Mes 5, día 1 | 4 718 | **16 756** | 3 | **8/8** | 2 / 0 |

Hitos cualitativos:

- **Día 4:** la UI muestra patrimonio 1 225 u. con 3 obras en curso y 9 120 u. ya gastadas en
  construcción. Las obras en curso no se capitalizan; el jugador ve una caída a casi cero que se
  corrige al terminar los edificios (13 231 u. al cierre del mes 1). Es el mayor susto contable de
  la partida.
- **Mes 1:** 4 inquilinos iniciales; 2 llegadas del mercado tras el cierre llenan parte de los
  huecos. La previsión de cierre es positiva (774 ingresos / 351 gastos).
- **Mes 2:** el jugador llena 6/8; el rival sigue con 0 ocupadas. Se puja por el contrato y se
  cancela el seguro. El sabotaje (tick 73 050) incendia la acería rival; queda en ruina.
- **Mes 3:** 7/8; el contrato se adjudica al jugador (100 u., fianza 42). El rival paga 20 u. de
  impuesto de propiedad con 49 u. de caja; su taller queda con backlog de mantenimiento 60 y
  condición 95.
- **Mes 4:** 8/8; el contrato se completa y devuelve la fianza; la caja sube a 4 718 u. El rival
  termina con 49 u., 22 de acero sin vender y 0/3 unidades ocupadas.

---

## 4. Defectos y problemas

### 4.1 P0 — bloqueantes, integridad y rendimiento

#### P0-1. La proyección con un préstamo `offered` es inválida y bloquea todo el flujo de préstamos de la UI

- **Síntoma:** al pulsar «Solicitar 600 u. · 12 meses» en la UI, la petición se acepta, pero la
  oferta nunca aparece y no hay forma de aceptarla. La UI se queda con la proyección anterior.
- **Causa:** `createViewProjection` incluye **todos** los préstamos del jugador en
  `banking.loans`, incluidos los `offered` (`packages/simulation/src/projection.ts:427-440`). El
  esquema del cliente sólo admite `active | delinquent | paid_off | defaulted`
  (`packages/shared/src/projection.ts:619-630`). `viewProjectionV1Schema.safeParse` falla con
  `economy.banking.loans.0.status: Invalid option`; `SimulationWorkerClient.handleMessage` rechaza
  la proyección completa y muestra el error de transporte. El `offers` array sí contiene la oferta,
  pero nunca llega a renderizarse.
- **Evidencia:** sonda headless `offered_loan_projection`:
  `{"schemaOk":false,"issues":[{"path":"economy.banking.loans.0.status","message":"Invalid option: expected one of \"active\"|\"delinquent\"|\"paid_off\"|\"defaulted\""}],"loanStatuses":["offered"],"offers":1}`.
  Captura `ui-loan-debug-crop.png`: el panel muestra «Solicitar 600 u. · 12 meses» y el estado
  vacío «Selecciona una parcela propia…», sin la oferta.
- **Impacto:** un jugador normal no puede usar préstamos, una de las tres palancas de crecimiento
  del juego. La parcela queda además bloqueada como garantía de un préstamo `offered` que no puede
  aceptarse ni cancelarse. Es el defecto funcional más grave de la sesión.
- **Mejora:** excluir los `offered` de `banking.loans` (ya están en `offers`) o añadir el estado al
  esquema y gestionarlo en la UI. Añadir un test de contrato que valide con `viewProjectionV1Schema`
  una proyección con una oferta pendiente, y un smoke de UI que pulse Solicitar → Aceptar.

#### P0-2. No existe condición de victoria, derrota, puntuación ni cierre de sesión

- **Síntoma:** no hay objetivo, marcador, comparación de patrimonio ni pantalla de fin. El HUD
  muestra caja, calendario, inventario, cuadrilla e influencia; el rival sólo publica parcelas,
  edificios y ocupados (`apps/web/src/App.tsx:1427-1432`). No se puede saber si se va ganando.
- **Impacto:** «ganar a la máquina» no está definido por el producto; el jugador no sabe cuándo
  terminar ni qué significa hacerlo bien. Cualquier informe de balance necesita inventar métricas.
- **Mejora:** declarar un objetivo de sesión y un resumen final (patrimonio, caja, deuda, renta,
  ocupación y comparación con el rival). Si el rival debe ser una amenaza medible, publicar una
  estimación de su patrimonio mediante el expediente de inteligencia ya existente o un «valor de
  distrito» agregado.

#### P0-3. El límite de capacidad de obra no se aplica

- **Síntoma:** `StartConstruction` valida `sum(crewCapacity) >= PLAYER_CREW_CAPACITY`, pero los
  sitios nacen con `crewCapacity: 0` y la UI nunca llama a `AllocateCrew`. Se pueden crear más
  obras que cuadrillas mientras haya caja/materiales. En la sesión se crearon 3 obras con 2
  cuadrillas; la sonda headless creó 2 con 2 cuadrillas y `crewCapacitySum: 0`. La UI anuncia
  «la capacidad de trabajo está reservada» sin reservar nada.
- **Evidencia:** `packages/simulation/src/commands.ts:668-671` y `:699`; `:563-580`
  (`AllocateCrew`); `apps/web/src/App.tsx:910-912` (la UI mira cuadrillas libres, no capacidad).
- **Impacto:** se rompe el coste de oportunidad de las obras; se puede preparar un banco de obras y
  asignar cuadrillas después, lo que facilita el apalancamiento y hace que el botón de construcción
  pueda habilitarse sin capacidad real.
- **Mejora:** reservar la capacidad de forma atómica al crear el sitio (asignar una cuadrilla o
  descontar capacidad) o sustituirla por una cola de obras explícita. Invariante: suma de
  capacidades de obras propias ≤ 2.

#### P0-4. Se puede vender una parcela que garantiza un préstamo y aceptar después la oferta

- **Síntoma:** se compra una parcela, se pide un préstamo de 600 u. con esa garantía, se vende la
  parcela al banco por 680 u. (85 %) y se acepta la oferta. Todo se acepta: la parcela queda sin
  dueño, el préstamo queda `active` con `collateralParcelId` apuntando a una parcela que ya no es
  del deudor y el jugador acaba con 12 468 u. de caja.
- **Evidencia:** sonda `sell_collateral`:
  `{"buy":true,"loan":true,"sell":true,"accept":true,"parcelOwnerAfterSell":null,"loanStatus":"active","loanCollateral":"parcel_00000005","playerCash":12468}`.
  `SellParcel` (`commands.ts:620-640`) no comprueba préstamos; `AcceptLoanOffer`
  (`commands.ts:490-510`) no revalida la garantía; `openAuctionForLoan` (`systems.ts:505-525`)
  crea la subasta con la parcela aunque ya no pertenezca al prestatario.
- **Impacto:** fuga de integridad del banco y del mercado de suelo; el jugador puede extraer
  liquidez contra una garantía que el banco cree tener y la subasta puede adjudicar una parcela
  sin dueño. La venta además deja la parcela en el mercado (no se transfiere al banco), lo que
  permite recomprarla.
- **Mejora:** bloquear la venta si existe préstamo/oferta con esa garantía, o liquidar/refinanciar
  antes; validar la cadena de garantías al cargar; añadir un test de conservación de garantías.

#### P0-5. La política de mantenimiento es global y el jugador controla la del rival

- **Síntoma:** al cambiar «Mantenimiento» a diferido desde la UI del jugador, la condición del
  taller del rival baja de 95 a 90 y su backlog sube de 60 a 120 en un mes, igual que la del
  jugador (100 → 95). Existe un único `phase2.maintenance` con un solo `policy`; `settleMaintenance`
  recorre **todos** los edificios y aplica la misma política, debitando a cada propietario.
- **Evidencia:** sonda `global_maintenance`:
  `before {playerCondition:100, rivalCondition:95, rivalBacklog:60}` →
  `after {playerCondition:95, rivalCondition:90, rivalBacklog:120, policy:"deferred"}`;
  `packages/simulation/src/state.ts` (Phase2State.maintenance), `systems.ts:633-678`,
  `commands.ts` (SetMaintenancePolicy sin organización).
- **Impacto:** el jugador puede degradar la condición y la liquidez del rival con un clic, sin
  coste ni decisión del rival; el rival no tiene política propia. Rompe la separación de
  organizaciones y hace que el mantenimiento no sea una decisión estratégica real.
- **Mejora:** política por organización (mapa `organizationId → policy`) o, si se quiere una
  regulación distinta, declararla como norma municipal y dar al rival la misma capacidad de
  decidir. Añadir un test de que el toggle del jugador no altera los edificios del rival.

#### P0-6. Una ruina conserva valor contable completo

- **Síntoma:** la acería del rival, destruida por el sabotaje, queda `state: "ruin"` pero
  `condition: 100`; `buildingValue` usa la condición y no el estado, así que se contabiliza a
  5 200 u. (valor completo). Con condición 0 aún valdría 2 600 u. (el mínimo del 50 %). El
  patrimonio contable del rival (13 797) está inflado por un edificio destruido.
- **Evidencia:** `packages/simulation/src/projection.ts:93-105` (valor por condición, sin filtrar
  `state`); snapshot final: `building_00000003` `{"state":"ruin","condition":100}`, valor rival
  9 190; sonda `ruin_valuation`: `valueWithRuinAsSaved: 9190`, `valueWithConditionZero: 6590`.
- **Impacto:** el marcador de patrimonio no reconoce el daño; el sabotaje no reduce el patrimonio
  del rival y el jugador no puede evaluar el coste real de un incendio. La UI además muestra
  «Acería · nivel 1 · estado 100 %» y «estado burning» en la misma ficha, con dos significados de
  «estado».
- **Mejora:** excluir las ruinas del valor de catálogo (o valorarlas a 0) y separar condición de
  estado en la UI. Un edificio en ruina no debería conservar valor de catálogo ni seguir mostrando
  una instalación de producción como operativa.

#### P0-7. Rendimiento de la escena en el entorno de prueba

- **Observado:** la simulación mantiene 80 t/s, pero el frame de la página se queda en ~9 FPS
  (media 112,7 ms, mediana 116,6 ms, p95 149,9 ms, máx. 850 ms) **también a 1× y 2×**. Hay 16 138
  long tasks (media 96,3 ms, p95 117 ms, máx. 725 ms), aproximadamente una por frame. El proceso
  GPU software (`SwiftShader`) consume ~366 % de CPU; el proceso de render de la página ~1,7 %.
  El cuello es el rasterizado de la escena, no el Worker.
- **Evidencia:** `perf.json` de la sesión; las muestras de 10 s dan 79,7–80,3 t/s; el test corto de
  velocidad da 1×/2×/4× = 22,7/44,0/88,0 t/s y 100–117 ms/frame en los tres casos. La velocidad no
  cambia el frame: el coste es de render, no de proyecciones.
- **Matiz importante:** Chromium headless con SwiftShader es el peor caso (sin GPU). Hay que
  repetir la medición en hardware con GPU antes de declarar un fallo universal. Aun así, el
  fallback software es un escenario real (equipos sin aceleración, escritorios remotos) y a 9 FPS
  la UI no es fluida.
- **Mejora:** medir en GPU; si se confirma, reducir el coste de la escena (culling por zoom,
  atlas, bajar resolución del canvas/DPR, limitar decoración) y desacoplar la UI del canvas.
  Throttlear las proyecciones a la frecuencia de pintado (5–10 Hz) con `startTransition` y
  selectores; hoy se reciben ~40/s y se renderizan ~9/s, con ~31/s descartadas.

### 4.2 P1 — problemas funcionales, de información y de equilibrio

#### P1-1. El impuesto de propiedad se rotula «anual» pero se cobra mensualmente

- La UI dice «propiedad 1,2 % anual · próxima liquidación en tick 36 000 · previsión 32 u./mes»
  (`apps/web/src/App.tsx:431-432`); la ficha de una parcela de 800 u. dice «propiedad 10 u./mes».
  El motor aplica `calculateTax(base, 120)` en **cada** liquidación mensual
  (`systems.ts:589-631`, `game-data.ts:313`); el test `phase2.test.ts:794` espera 10 u. sobre 800
  en el cierre mensual. El tipo efectivo es ~14,4 % anual, no 1,2 %.
- **Impacto:** el jugador subestima el coste fiscal un factor ~12; la previsión y la comparación de
  rentabilidad quedan sesgadas.
- **Mejora:** decidir el periodo y alinear motor, UI, documentación y tests. Si se quiere 1,2 %
  anual, dividir por 12 en la liquidación; si es mensual, rotularlo como mensual.

#### P1-2. Las mejoras destruyen patrimonio y no se amortizan en 30 minutos

- `buildingValue` usa el coste base y no incluye la mejora. Una mejora de taller cuesta 2 200 u. +
  1/2/1 de materiales y sube la renta un 25 %; en la sonda, el patrimonio bajó **1 960 u.** y la
  renta subió a 225 u. (desde 180), sin aumento del valor del activo. En un horizonte de 4 meses,
  la mejora no recupera la inversión. Lo mismo ocurre con el cuarto edificio: construir tarde
  consume materiales y sólo cobra una o dos rentas.
- **Evidencia:** `projection.ts:93-105`; sonda `upgrade_value`:
  `{"upgrade":"accepted","upgraded":true,"rent":225,"assetsBefore":13426,"assetsAfter":11466,"delta":-1960}`.
- **Impacto:** el jugador racional no mejora ni construye después del mes 1; el juego se queda sin
  decisiones de inversión para la segunda mitad de la sesión.
- **Mejora:** capitalizar la mejora (o parte), bajar su coste, aumentar el bonus de renta o
  extender el horizonte. Mostrar el payback y el efecto en patrimonio antes de confirmar.

#### P1-3. `InvestInProduction` es un comando muerto y la superficie UI/contrato diverge

- `InvestInProduction` busca una instalación `kind === "legacy"` que el estado inicial nunca crea;
  siempre devuelve `FACILITY_NOT_FOUND` (`commands.ts:536-560`). La UI no lo expone. `SellParcel`,
  `RequestPermit`, `AllocateCrew`, `CommitCrime` y `attack_agent` tampoco tienen control en
  `App.tsx`; `RequestPermit` es redundante porque `StartConstruction` emite el permiso con 100 %
  de aprobación en el catálogo actual.
- **Evidencia:** sonda `commands`: `invest: FACILITY_NOT_FOUND`, `permit: accepted`;
  `client.ts:118-229` y `:343-354`; `App.tsx` no contiene esas llamadas.
- **Impacto:** la superficie real del producto y la del contrato divergen; los tests cubren rutas
  que un jugador no puede alcanzar y faltan pruebas de la ruta que sí usa.
- **Mejora:** decidir qué comandos son de producto y cuáles legado; exponer los primeros y retirar
  los segundos. Añadir una matriz de cobertura UI ↔ comando en CI.

#### P1-4. La ruta ilegal no tiene botón y su calor la convierte en una trampa

- La UI muestra el beneficio, la detección estimada y el cooldown, pero no hay botón para ejecutar
  `CommitCrime` (`App.tsx:1256-1263` y `client.ts:201-209`). Cada intento suma +2 de heat; la
  detección es `35 + heat*5 + policePressure*3`; el heat sólo baja 1 cada 5 días
  (`systems.ts:707-723`). En la sonda, el primer intento se acepta (heat 2, cooldown 2 400 ticks =
  2 días) y el segundo devuelve `CRIME_COOLDOWN`.
- **Impacto:** el jugador ve una opción que no puede usar; si se expone, el uso repetido castiga
  más de lo que el texto sugiere y el valor esperado se vuelve negativo.
- **Mejora:** exponerla con confirmación y probabilidad real; rebalancear el heat (decaimiento
  diario o rendimientos decrecientes explícitos) y mostrar el valor esperado. Si no se quiere en
  Alpha, ocultar también el texto.

#### P1-5. El rival puede quedar en un estado económico muerto sin recuperación

- Al final, el rival tiene 49 u. de caja, 0/3 unidades ocupadas, 22 acero (3 520 u.) sin sumidero
  de venta, una acería en ruina y un taller con backlog 60. Su última acción es
  `reserve_liquidity`; no tiene una acción válida que preserve la liquidez mínima. No puede vender
  el acero, no puede vender sus parcelas (ambas tienen edificio), no puede pedir un segundo
  préstamo (ya tiene uno) y no tiene un candidato para despejar la ruina. La IA construyó
  producción sin comprobar la demanda y perdió la carrera por los inquilinos frente a los dos
  talleres del jugador.
- **Evidencia:** snapshot final (`rivalAi`, balances, inventarios, edificios); `systems.ts`
  (`rivalAction`, candidatos y `reserve_liquidity`); `projection.ts` (inventario a precio de
  mercado).
- **Impacto:** la IA deja de ser una amenaza en la segunda mitad de la partida; el jugador gana por
  inanición del rival, no por una competición sostenida. Además, su patrimonio contable se infla
  con activo muerto.
- **Mejora:** dar a la IA una salida (venta de materiales, liquidación de activos, segundo
  prestamista o refinanciación), comprobar demanda de inquilinos antes de construir, y permitirle
  despejar ruinas/reconstruir. Reducir la reserva mínima o hacerla dependiente de la situación.

#### P1-6. El sabotaje es demasiado barato y el daño no se refleja en el marcador

- La acería rival fue saboteada y quedó en ruina, pero:
  - el incidente se atribuyó públicamente al jugador (`publiclyAttributedOrganizationId:
    org_00000001`) y **no generó ningún hecho de reputación** porque no hubo bajas (el edificio
    estaba vacío);
  - no generó encuentro de facción (`factions` vacío), así que el rival no reaccionó;
  - el valor contable del edificio no bajó (P0-6);
  - la UI permite ordenar sabotaje sobre un edificio ya en llamas (la captura
    `sabotage-effect.png` muestra el botón activo sobre `estado burning`).
- **Impacto:** el sabotaje es una acción de bajo riesgo y alto impacto en la economía real del
  rival, pero el marcador no lo reconoce y la IA no responde. Es una fuente de dominancia y de
  incoherencia narrativa.
- **Mejora:** registrar destrucción de propiedad en la reputación aunque no haya bajas; crear
  hostilidad de facción; valorar la ruina a 0; deshabilitar el botón en edificios no operativos;
  dar a la IA una respuesta (reconstruir, asegurar, represalia) y un coste/cooldown mayor.

#### P1-7. La demanda de inquilinos exige hueco libre y asequible, pero la UI no lo explica

- `admitArrivals` sólo crea llegadas si hay huecos libres y asequibles:
  `arrivals = min(free, affordable, ...)` (`housing-market.ts:484-550`). Si construyes tarde no
  llegan inquilinos porque no hay hueco; si construyes antes, las llegadas llenan. La UI muestra
  población, techo y vacantes, pero no la regla ni la razón de que no llegue nadie.
- **Impacto:** el jugador puede concluir que «no hay demanda» cuando el problema es el precio o la
  falta de hueco; o construir y quedarse con vacancia si el precio supera el presupuesto del
  segmento.
- **Mejora:** mostrar «llegadas previstas si hay hueco», explicar la asequibilidad y avisar cuando
  la renta efectiva supera el presupuesto del segmento. Añadir una vista de demanda con la razón
  de no-llegada.

#### P1-8. Compra de materiales de 2 en 2, capacidad de almacén oculta y sin «comprar lo que falta»

- La UI sólo ofrece «Comprar 2» por recurso (`App.tsx:608-627`); un taller necesita 10 ladrillos
  (5 clics) y un patio 8 (4 clics). La capacidad del almacén es 40
  (`state.ts:203`) y el HUD muestra sólo los recursos, no el total/capacidad (`App.tsx:386-405`).
  En la prueba de humo, comprar 8 cemento + 12 ladrillo de golpe falló con `INVENTORY_CAPACITY`;
  en la sesión hubo que intercalar compras y obras. Las opciones de construcción no tienen un
  botón de compra agregada.
- **Impacto:** micromanagement y errores evitables; el jugador no puede planificar una obra grande
  sin abrir otro panel y contar.
- **Mejora:** botón «comprar faltante» por obra, cantidad libre o ±, indicador `usado/capacidad` y
  aviso previo si la compra no cabe.

#### P1-9. El inspector queda bajo el pliegue, el panel financiero tapa la selección y el resultado del mes mezcla capex y opex

- Con «Resumen financiero» abierto, la selección de parcela y sus acciones quedan fuera de la
  vista en 1600×1000; hay que hacer scroll. El panel lateral acumula onboarding, estado,
  financiero, alertas, cartera, materiales, financiación, selección, riesgo/política, concejo,
  libro de caja y diagnóstico (`App.tsx:368-1519`). No hay cabecera sticky ni acceso directo.
- El «resultado del mes» incluye compras de suelo, materiales y construcción: en el mes 1 mostraba
  «ingresos 0 · gastos 15 237 · resultado −15 237» aunque la previsión era positiva
  (`projection.ts:70-105`, `App.tsx:408-430`). Las obras en curso tampoco se capitalizan: en el
  día 4 el patrimonio era 1 225 u. con 3 obras en marcha y 9 120 u. ya gastadas; al completar los
  edificios saltó a 13 231 u.
- **Impacto:** el jugador puede interpretar una inversión inicial como una pérdida operativa y
  abandonar una estrategia viable; la selección de parcela, la acción más frecuente, requiere
  scroll y pierde contexto en 4×.
- **Mejora:** separar capex y opex; capitalizar obra en curso; ficha de selección sticky o panel
  derecho con pestañas; colapsar paneles secundarios; mostrar payback y previsión de caja a 3/6
  meses.

#### P1-10. La puja de contrato arranca en el presupuesto máximo y la IA no puja por liquidez

- El formulario inicializa el importe con `contract.budget` (420 u.) (`App.tsx:1540`); la IA puja
  el 92 % (386,4 u.) (`public-contracts.ts:42`). Si la IA puja, el valor por defecto pierde. En la
  sesión la IA no pujó: su reserva de liquidez (2 500 u.) le exigía mucha más caja que la fianza de
  42 u., y terminó la partida con 49 u. de caja. El jugador pujó 100 y ganó.
- **Impacto:** el valor por defecto es una trampa cuando el rival compite; la IA desaprovecha
  contratos rentables por una reserva rígida.
- **Mejora:** mostrar una referencia de puja del rival o un rango, inicializar en un valor
  competitivo y separar la reserva de liquidez del coste de la fianza.

#### P1-11. La probabilidad de la ordenanza no muestra el alineamiento del concejo

- La UI explica «apoyo base X %; cada influencia adicional suma 15 puntos»
  (`App.tsx:1729-1748`), pero el motor añade `councilAlignmentPercent`. En la sesión, 65 % base +
  2 influencia + 21 de alineamiento = 95 % final; el jugador no puede preverlo. En la sonda de UI,
  la misma secuencia aprobó «Renovación de barrio» y dejó la influencia a 0.
- **Impacto:** se infravalora una acción de alto impacto y se gasta influencia a ciegas.
- **Mejora:** mostrar la probabilidad final desglosada (base + influencia + alineamiento) y el
  coste/beneficio esperado antes de confirmar.

#### P1-12. La capa política y los sistemas de riesgo no se manifiestan en 30 minutos

- La primera elección está programada para el tick 216 000 (6 meses), fuera de la sesión; no hubo
  debate, coalición ni cambio de gobierno. El `moodByIssue.employment` terminó en 0 mientras
  vivienda/seguridad/servicios/impuestos estaban a 100, pero no hubo consecuencia visible.
- No se alcanzaron subastas, refinanciación, impago, despeje de ruina propio ni reparación con
  condición < 100 (el mantenimiento equilibrado mantiene 100). El seguro del jugador se compró y
  canceló sin siniestro; el único siniestro fue de un edificio sin póliza y quedó excluido.
- **Impacto:** una parte importante de los sistemas Alpha existe pero no se ve en la sesión de
  30 min; el jugador percibe un juego económico más estrecho de lo que el motor contiene.
- **Mejora:** adelantar un evento político o una licitación adicional dentro de los primeros 4
  meses; hacer que el desgaste/seguro/impago sea alcanzable en una sesión corta; o aceptar que
  estos sistemas son de horizontes largos y comunicarlo.

### 4.3 P2 — pulido, accesibilidad y deuda de DX

- **Mapa oscuro y poco denso:** el distrito piloto se ve casi vacío; 3 edificios ocupan una esquina
  y el resto es terreno oscuro. No hay minimapa, lista de parcelas ni filtros. Coincide con la
  prioridad de densidad urbana ya registrada; para el playtest, comprar/inspeccionar es lento.
- **Progreso de obra sin vista global:** el HUD cuenta «obras activas», pero no hay cola con
  progreso, cuadrilla y ETA; hay que seleccionar cada parcela.
- **Sin aviso destacado de obra terminada/vacante:** si el gestor de propiedad no está activo, el
  jugador debe descubrir el hueco. Añadir alerta y enlace a la ficha.
- **«Enviar técnico»/«Reparar» sin efecto visible a condición 100:** el técnico se mueve, pero no
  hay nada que reparar; el juego no explica que el mantenimiento equilibrado ya mantiene la
  condición.
- **Dos significados de «estado»:** la ficha muestra «Acería · nivel 1 · estado 100 %» (condición)
  y «estado burning» (estado del edificio). Separar «condición» y «estado».
- **Botón de sabotaje activo sobre edificio en llamas/ruina:** la UI no lo deshabilita.
- **Error de textura en desarrollo:** en Vite dev se reproduce
  `TypeError: Cannot read properties of null (reading 'renderer')` en
  `IsometricSpikeScene.registerImageTexture` (`registerTexturesFromBundle`), por el doble montaje
  de `StrictMode`; en producción no aparece. Es deuda de DX, no del build.
- **Bundle inicial grande:** `index-*.js` = 1 922,54 kB min / 493,51 kB gzip; Vite avisa de chunk
  > 500 kB. Art Lab, Visual Slice y Phaser van en el bundle principal.
- **Accesibilidad:** los paneles son `<details>` sin `aria-expanded`/`aria-controls`; el mapa no
  tiene alternativa de teclado; el foco de los botones no es evidente.
- **Memoria:** el heap JS pasó de 81,4 MB a 97,4 MB (+20 %) y se estabilizó tras el mes 3; no es
  una fuga continua en 30 min, pero conviene vigilarlo con sesiones más largas.
- **El favicon no genera 404:** `index.html` usa `data:,`; no se observó petición fallida.

---

## 5. Rendimiento medido

| Métrica | Valor | Lectura |
|---|---:|---|
| Tick rate en ventanas de 10 s (n=169) | media **79,91 t/s**, p50 80,00, p95 80,23, p99 80,33, máx 80,98 | La simulación cumple el reloj de 4×; 144 000 ticks ≈ 30 min |
| Tick rate en ventanas cortas 1×/2×/4× | 22,7 / 44,0 / 88,0 t/s | Sesgo de borde de la ventana de 1,5 s; usar las muestras de 10 s |
| Intervalo de frame (n=16 123) | media **112,7 ms**, p50 116,6, p95 149,9, p99 216,6, máx 850 | **~9 FPS**; igual a 1×, 2× y 4× ⇒ cuello de render |
| Long tasks (n=16 138) | media 96,3 ms, p50 95, p95 117, p99 139, máx 725 | ~1 long task por frame; el hilo principal/compositor está saturado |
| Latencia de comandos directos (n=33) | media 165,9 ms, p50 148,3, p95 570,9, máx 630,8 | IPC + tick + bloqueo de render; la UI a 9 FPS añade latencia |
| Proyecciones | 72 266 en ~30 min ≈ **40/s**; frames renderizados ≈ 9/s | ~31 proyecciones/s descartadas; candidato claro a throttle |
| Heap JS | 81,4 MB → 97,4 MB (+20 %); estable tras el mes 3 | Vigilar en sesiones largas |
| Proceso GPU (SwiftShader) | ~366 % CPU; render de página ~1,7 % | El rasterizado software es el cuello, no el Worker |
| Errores de página / consola / red | **0 / 0 / 0** | Build de producción estable |
| Bundle JS inicial | 1 922,54 kB min / 493,51 kB gzip | Vite avisa >500 kB; code-splitting pendiente |

Interpretación:

- **La simulación no es el problema.** 80 t/s con 169 muestras y un pico de 80,98; el cierre
  mensual no produjo una caída del tick. El coste del Worker es irrelevante en esta escala.
- **El frame es el problema en este entorno.** La tasa es la misma a 1× y 4×: no lo causan las
  40 proyecciones/s, sino el render de la escena (Phaser + SwiftShader). En un navegador con GPU
  puede mejorar mucho; hay que medirlo. Aun así, el fallback software es inviable y el juego
  debería degradar la escena (resolución, decoración, culling) cuando no hay GPU.
- **La UI va por detrás de la simulación.** Con 40 proyecciones/s y 9 FPS, React descarta la
  mayoría; el estado mostrado es el último frame, no el último tick. No se observaron errores,
  pero la sensación es de lag en clics y en mensajes.
- **El cierre mensual no se pudo aislar** del ruido de frames; no se vio un hitch específico. En
  esta escala (3 edificios, 23 parcelas) el coste del cierre es pequeño; el problema es continuo.
- **La memoria se estabilizó**; el salto de 16 MB coincide con el sabotaje/incendio y una captura,
  no con un crecimiento lineal. No se declara fuga, pero se recomienda medir 60 min.

---

## 6. Cobertura de opciones

| Opción | Cómo se probó | Resultado |
|---|---|---|
| Velocidad 1×/2×/4×, pausa/continuar | UI, con medición de tick y frame | OK; 4× = 80 t/s; pausa Δtick=0; frame ~9 FPS en los tres |
| Panel plegable y 5 capas de mapa | UI | OK; sin errores |
| Compra de parcela en el mapa | UI (clic real) + comando | OK; la IA compra la más barata si tardas (carrera del día 1) |
| Construcción desde la UI | UI, taller | OK; el botón exige cuadrilla libre, pero el límite real no se aplica (P0-3) |
| Asignación de cuadrilla desde la UI | UI | OK |
| Asignación de inquilino desde la UI | Sonda UI con snapshot controlado | OK; el botón «Ocupar con…» asigna y llena el hueco |
| Gestor de propiedad / finanzas / reparación | UI, toggles | OK; el gestor de vacantes es útil; finanzas no tiene caso si no hay garantía libre |
| Política de mantenimiento | UI, diferido↔equilibrado | OK en la UI; el efecto es global y afecta al rival (P0-5) |
| Ordenanza: retirar, proponer, promover | UI, partida fresca | OK; retirar → withdrawn, proponer → proposed, lobby → activa (Renovación) |
| Inteligencia (caja disponible) | UI | OK; 150 u., estimación 1 300 u. con 90 % de acierto |
| Seguro: comprar y cancelar | UI | OK; `fire_basic` 25 u./mes, 2 primas pagadas, cancelación sin devolución |
| Guardar y cargar | UI (IndexedDB) | OK; tick 36 460 → 36 548 tras la recarga; estado restaurado |
| Puja de contrato público | UI, 100 u. | OK; adjudicado y completado (100 u. netas + fianza devuelta) |
| Sabotaje con enforcer | UI | OK; acería rival en ruina; sin coste reputacional por 0 bajas (P1-6) |
| Préstamo: solicitar y aceptar | UI | **FALLA**; la proyección con `offered` es inválida y la oferta no se renderiza (P0-1) |
| Mejora de edificio | UI (inicio) + sonda headless | La UI inicia la mejora; el patrimonio baja 1 960 u. y la renta sube 25 % (P1-2) |
| Vender parcela | Comando headless | Aceptado, 85 % del precio; permite vender garantía (P0-4) |
| Permiso | Comando headless | Aceptado; redundante con `StartConstruction` |
| `InvestInProduction` | Comando headless | `FACILITY_NOT_FOUND`; comando muerto (P1-3) |
| `CommitCrime` (ruta ilegal) | Comando headless | Aceptado (heat 2, cooldown 2 400 ticks); segundo intento `CRIME_COOLDOWN`; sin botón UI |
| `RepairBuilding` a condición 100 | Comando headless | `BUILDING_CONDITION_FULL`; el botón de la UI está deshabilitado |
| `ClearRuin` sobre edificio operativo | Comando headless | `RUIN_REQUIRED`; no hay ruina propia en la sesión |
| `AllocateCrew` | Comando headless | Aceptado; no mueve agentes ni reserva capacidad real |
| Subastas, refinanciación, impago | No alcanzables | Sin préstamo impagado ni subasta en 4 meses |
| Elecciones, debate, cambio de gobierno | No alcanzables | Primera elección en tick 216 000; la sesión termina en 144 220 |
| Ruina propia / despeje | No alcanzable | Sólo el rival tiene una ruina; el botón es para parcelas propias |

---

## 7. Mejoras priorizadas

### P0 — antes de ampliar contenido

1. **Arreglar el contrato de proyección de préstamos** (P0-1): excluir `offered` de
   `banking.loans` o añadir el estado al esquema y a la UI; test de proyección con oferta pendiente
   y smoke UI Solicitar → Aceptar. Es un bloqueo de una palanca central.
2. **Definir victoria/derrota/cierre y resumen final** (P0-2): objetivo, patrimonio, renta,
   ocupación y comparación con el rival; guardar el resultado.
3. **Reservar capacidad de obra de verdad o sustituirla por una cola** (P0-3): invariante ≤ 2.
4. **Cerrar la venta de garantías y revalidar al aceptar el préstamo** (P0-4): tests de
   conservación de garantías y subastas.
5. **Política de mantenimiento por organización** (P0-5) y **ruinas a valor 0** (P0-6).
6. **Fiscalidad coherente** (P1-1; corrección barata aunque su severidad sea P1): mensual vs
   anual, UI, docs y tests.
7. **Rendimiento de escena** (P0-7): medir en GPU; si se confirma, culling/atlas/resolución,
   throttle de proyecciones (5–10 Hz) y desacoplar UI del canvas. Objetivo 60 FPS a 4× en la
   máquina de referencia.

### P1 — siguiente iteración de producto

8. Contabilidad: capex vs opex, capitalización de obra en curso y de mejoras, valor de inventario
   según su liquidez real (P1-2, P1-9).
9. Compra de materiales agregada, capacidad visible y «comprar faltante» (P1-8).
10. Inspector sticky/pestañas y cola de obras con progreso/ETA y alertas de fin de obra (P1-9).
11. Explicar demanda/vacancia y llegadas; previsión de ocupación y de caja a 3/6 meses (P1-7).
12. Exponer o retirar comandos legado (`InvestInProduction`, `AllocateCrew`, `RequestPermit`,
    `SellParcel`, `CommitCrime`, `attack_agent`) y cubrirlos con UI/tests (P1-3, P1-4).
13. Transparencia de contrato y ordenanza: puja de referencia, default competitivo, probabilidad
    final con alineamiento (P1-10, P1-11).
14. IA: salida de liquidez (venta de materiales/liquidación/segundo préstamo), comprobar demanda
    antes de construir, despejar ruinas/reconstruir y reaccionar al sabotaje (P1-5, P1-6).
15. Rebalancear el sabotaje: coste reputacional por destrucción de propiedad, hostilidad de
    facción, ruina a 0, botón deshabilitado en edificios no operativos, respuesta de la IA.
16. Pacing político: adelantar un evento/elección o aceptar y comunicar que es de horizonte largo
    (P1-12).

### P2 — pulido

17. Mapa: contraste, minimapa/lista de parcelas, filtros y leyenda de overlays; densidad urbana.
18. Alertas de fin de obra/vacante y de cambios de política; estados vacíos más útiles.
19. Accesibilidad: teclado en el mapa, foco visible, `aria-expanded` en `<details>`.
20. Code-splitting de Art Lab/Visual Slice/Phaser; medir LCP en 3G/4G.
21. Guardar instrumentación de sesión (D-063): FPS, latencia, rechazos y ocupación, sin persistir
    estado autoritativo.
22. Corregir el error de textura en dev (`StrictMode` + registro asíncrono de Phaser) y la
    duplicidad «estado/condición» en la ficha.

---

## 8. Evidencia y reproducción

### 8.1 Artefactos

- `artifacts/playtest-2026-10-28/buildings-complete.png` — 3 edificios, panel financiero con el
  patrimonio 12 625 y la fiscalidad «1,2 % anual / 32 u./mes».
- `artifacts/playtest-2026-10-28/month-3.png` — taller propio 3/3, renta efectiva 215, seguro y
  ficha de explotación.
- `artifacts/playtest-2026-10-28/sabotage-effect.png` — acería rival en llamas, «estado burning ·
  integridad 87 %», botón de sabotaje aún activo.
- `artifacts/playtest-2026-10-28/final.png` — estado final.
- `artifacts/playtest-2026-10-28/session.jsonl` — 169 muestras de rendimiento y todos los eventos.
- `artifacts/playtest-2026-10-28/monthly.json` — cierres mensuales.
- `artifacts/playtest-2026-10-28/perf.json` — frames, long tasks, memoria, latencias.
- `artifacts/playtest-2026-10-28/final-snapshot.json` — estado autoritativo completo (incluye
  ambos organizaciones; no lo expone la UI).
- `artifacts/playtest-2026-10-28/final-projection.json` — última proyección.
- `artifacts/playtest-2026-10-28/analysis.json` — tabla final y comparación calculada.
- `artifacts/playtest-2026-10-28/ui-loan-debug.png` y `ui-loan-debug-crop.png` — el panel de
  financiación con la oferta creada en el Worker pero sin el botón «Aceptar oferta».
- `artifacts/playtest-2026-10-28/ui-coverage2.log` — sonda de UI: política, inquilino y mejora OK;
  préstamo UI falla.

### 8.2 Reproducción de los defectos

- **Préstamo UI (P0-1):** partida fresca con `seed=1`; comprar `parcel_00000005`; seleccionar la
  parcela; abrir «Financiación»; pulsar «Solicitar 600 u. · 12 meses»; esperar. La proyección del
  Worker contiene `banking.offers[0]` y `banking.loans[0].status = "offered"`; la UI sigue
  mostrando el estado vacío. En la sonda headless, `viewProjectionV1Schema.safeParse` devuelve
  `success: false` con la ruta `economy.banking.loans.0.status`.
- **Venta de garantía (P0-4):** estado inicial `seed=1`; comprar `parcel_00000005`; pedir 600 u. a
  12 meses con esa garantía; vender la parcela; aceptar la oferta. Resultado: parcela sin dueño,
  préstamo activo, caja 12 468 u.
- **Mantenimiento global (P0-5):** cargar `final-snapshot.json`; localizar un edificio del jugador
  y el taller operativo del rival; `SetMaintenancePolicy(deferred)`; avanzar 36 000 ticks. Resultado:
  condición del jugador 100 → 95, condición del rival 95 → 90, backlog del rival 60 → 120.
- **Ruina con valor (P0-6):** en `final-snapshot.json`, `building_00000003` es una acería en
  `ruin` con `condition: 100`; el valor de catálogo del rival es 9 190; con condición 0 baja a
  6 590. El valor de la acería (5 200) se cuenta completo en la ruina.
- **Mejora sin valor (P1-2):** estado inicial; construir un patio; comprar 1/2/1 materiales;
  `UpgradeBuilding`; completar la obra. Renta 180 → 225; activos 13 426 → 11 466 (−1 960).
- **Capacidad de obra (P0-3):** estado inicial; comprar 2 parcelas; iniciar 2 viviendas; las dos se
  aceptan con 2 cuadrillas y `crewCapacitySum: 0`. En la sesión se crearon 3 obras con 2
  cuadrillas.
- **Comandos muertos (P1-3/P1-4):** `InvestInProduction` → `FACILITY_NOT_FOUND`; `RequestPermit`
  → aceptado; `CommitCrime` → aceptado y luego `CRIME_COOLDOWN`; `RepairBuilding` a condición 100
  → `BUILDING_CONDITION_FULL`; `ClearRuin` sobre operativo → `RUIN_REQUIRED`.

### 8.3 Limitaciones del informe

- Una sola semilla, una sola estrategia y una sola sesión de 30 min; no es una campaña
  estadística. Los hallazgos de integridad y contrato son deterministas y no dependen de la
  semilla; los de equilibrio y rendimiento sí pueden variar.
- El rendimiento se midió en Chromium headless con SwiftShader. El frame de ~9 FPS es el peor
  caso; hay que repetirlo en GPU. La simulación (80 t/s) sí es representativa.
- La UI se condujo con Playwright y comandos directos; las esperas de render de 9 FPS pueden
  exagerar la latencia percibida respecto a un navegador con GPU.
- El rival se midió con `SaveSnapshot` después de la partida; la UI oculta su caja y su patrimonio
  a propósito. La estrategia del jugador se decidió con información pública.
- El juego no tiene una condición de victoria; la comparación por patrimonio, ocupación, renta y
  caja es una construcción analítica, no una regla del producto.
- El horizonte de 4 meses deja fuera elecciones, subastas, impagos y despeje de ruinas propias;
  las conclusiones sobre esos sistemas son de alcance, no de calidad.

---

## 9. Anexo — tabla mensual de la sesión

| Cierre | Tick | Caja | Patrimonio | Ingresos del periodo | Gastos del periodo | Edificios propios | Ocupadas | Rival (edificios/ocupadas) |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| Inicio (día 4) | 4 228 | 587 | 1 225 | 0 | 15 237 | 0 (3 obras) | 0 | 2 / 0 |
| Mes 1 | 36 024 | 1 193 | 13 231 | 792 | 186 | 3 | 4/8 | 2 / 0 |
| Mes 2 | 72 012 | 2 056 | 14 094 | 1 224 | 186 | 3 | 6/8 | 2 / 0 |
| Mes 3 | 108 080 | 3 202 | 15 240 | 1 399 | 228 | 3 | 7/8 | 2 / 0 |
| Mes 4 | 144 028 | 4 718 | 16 756 | 1 702 | 186 | 3 | 8/8 | 2 / 0 |

Notas:

- Los «gastos del periodo» del resumen financiero no incluyen todo el capex del mes 1; el
  «resultado −15 237» del inicio mezcla compras de suelo, materiales y construcción. Ver P1-9.
- La previsión final es 1 506 u. de ingresos, 351 u. de gastos y 5 873 u. de cierre; el jugador
  termina con 4 718 u. porque el cierre del mes 4 incluye el pago del contrato y la devolución de
  la fianza (142 u.) y el último alquiler.
- El rival termina con 49 u. de caja, 22 de acero (3 520 u.), una acería en ruina valorada a
  5 200 u., un taller operativo al 95 % con 0/3 ocupadas y un backlog de mantenimiento de 60 u.
