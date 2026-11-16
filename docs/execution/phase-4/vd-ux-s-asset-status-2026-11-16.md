# V.d-UX.S — Lenguaje visual de los estados invisibles del activo (acta, 2026-11-16)

Rama: `develop`. HEAD de los gates de código: `0d97d3a` (`feat: surface asset status in panels and
hubs with reactive section routing`). **13 commits locales sin push** (`59ae6b4..0d97d3a` más los de
S6). Decisión registrada: **D-107** (`docs/engineering/adr/D-107-estados-de-activo-como-presentacion.md`).

Estado de la fase: **PASS WITH HUMAN VISUAL GATE**. Todo lo medible está medido y verde; la revisión
visual de las capturas y el presupuesto de FPS en máquina con GPU corresponden al responsable. V.d
**no se cierra**: sigue pendiente el playtest humano heredado.

## 1. Qué se hizo visible y dónde estaba la verdad antes

`BuildingAssetState` es un enum cerrado de cuatro valores (`complete | construction | damaged |
burning`) con cuatro texturas por tipo de edificio. Todo lo demás existía en el motor y no se veía:

| Estado | Verdad antes | Canal ahora |
| --- | --- | --- |
| parcela con hipoteca al día | sólo texto en el hub Finanzas y en la ficha de parcela | **placa de parcela** + capa `Cargas y subastas` |
| préstamo en atraso | campana de alertas | placa + **badge** `loan` ámbar |
| préstamo impagado / subasta | campana | placa + **badge crítico** rojo (rombo) |
| mejora completada (`upgraded`) | sólo texto en la ficha del edificio | **marca de fachada** (estrella sobre mini-placa) |
| ocupación y vacancia | fichas individuales | capa `Ocupación` + badge sólo en vacancia total |
| póliza vencida o inexistente | ficha de Seguro | badge/capa `Seguro` + chip; el umbral de riesgo lo decide el motor |
| mantenimiento atrasado (backlog) | cifra suelta en la ficha | badge `upkeep` plegado o línea explícita en Mantenimiento |

## 2. Lenguaje adoptado

Cuatro canales con naturalezas distintas (badge = accionable, placa = pasivo persistente, marca de
fachada = logro, capa = lectura masiva) y gramática fija: **forma = severidad, glifo = causa,
color = familia**. Severidad por consecuencia (tier 1 = pérdida irreversible del activo, donde el
colapso y la adjudicación de subasta comparten nivel), un badge por edificio, tope global 12, orden
determinista `(tier, rank, key)` y umbrales de zoom 0.7 / 0.85 / 1.0 (0.85 si está seleccionado).
Animación sólo en tiempo de render: pulso 900 ms en críticos, destello 600 ms una vez por montaje de
escena, ambos con guarda `prefers-reduced-motion`. Especificación ampliada en
`docs/execution/phase-4/vd-ux-playable-interface-spec.md` §9.1–9.5 y §14.1.

## 3. Excepciones mínimas al dominio (las tres, con su motivo)

La consigna «cero cambios en simulation/shared» se sustituyó por la regla de encuadre de D-107: no se
oculta un bug de dominio tras la etiqueta «presentación pura», y no se inventa una regla económica
para que la UI sea más cómoda.

- **E1 · bug real** (`commands.ts`, `worker-runtime.ts`). Una póliza `lapsed` no podía comprarse
  (`BuyInsurance` la rechaza) ni cancelarse (`CancelInsurance` exigía `active`): callejón sin salida.
  Ahora `CancelInsurance` acepta `active | lapsed`. Se verificaron una a una las dependencias
  (`settleInsurance`, `processInsuranceClaim`, ofertas, alerta de sin-seguro, IA rival, automatización,
  `insuranceStatusLabel`) y se descartó `RenewInsurance` (inventaría gameplay) y `terminated` (tocaría
  enum, zod, snapshot, etiquetas y tests). `cancelled` pasa a significar **«contrato terminado»**.
- **E2 · arquitectura** (`shared/projection.ts` + `simulation/projection.ts`). Las alertas publican
  `reason: AlertReason` (9 valores) y `buildingId: BuildingId | null` en las ocho productoras, con tipo,
  zod y productor en el mismo commit. El `id` de la alerta deja de ser contrato: ningún consumidor
  parsea prefijos. Las alertas no se persisten ⇒ cero migración.
- **E3 · bug real** (`systems.ts`). Una ruina conservaba su póliza `active` hasta el vencimiento y
  `clear_ruin` borraba el edificio sin borrar el contrato. Además de estado muerto, `insuranceExpense`
  (que filtra por `status` pero no excluye ruinas) **inflaba el gasto previsto**. Ahora el contrato
  pasa a `cancelled` con `nextPremiumTick = null` en el mismo tick del colapso (barrido en orden
  canónico, que también repara saves heredados) y desaparece con el desescombro. **Los claims se
  conservan**: pertenecen al incidente.

## 4. Auditoría S0.5 de referencias vivas por `buildingId`

Regla aplicada: histórico deliberado ⇒ conservar; mapa de estado vivo que debe desaparecer con el
edificio ⇒ reportar antes de modificar. Reportado y autorizado por el responsable antes de tocar.

| Referencia | Veredicto | Acción |
| --- | --- | --- |
| `insurance.contractsByBuildingId` | vivo, huérfano | eliminar en `clear_ruin` |
| `maintenance.backlogByBuildingId` | vivo, huérfano (benigno para la deuda proyectada) | eliminar en `clear_ruin` |
| `agents.task {kind:"maintenance"}` | **bug real**: el técnico nunca liberaba la tarea y quedaba permanentemente no reasignable sobre una entidad inexistente | `releaseStaleMaintenanceTasks` en el barrido horario y en `clear_ruin` |
| `insurance.claimsByIncidentId`, `incidents`, `transactions` | histórico deliberado | conservar, afirmado con test de igualdad profunda |
| `tenants.activeContractBuildingId`, `facilities.buildingId`, `constructionSites.*BuildingId` | ya correctos / autocurados | sin cambio, afirmado con test |

No se amplió el audit a otras entidades ni se refactorizó el ciclo de vida de agentes.

## 5. Arquitectura de presentación

- **Puerta única** `apps/web/src/ui/asset-status.ts`: indexa loans, auctions, contracts, alerts y
  edificios y produce `loadsByParcelId` + `statusByBuildingId`. Nada de esto se duplica en la escena,
  los paneles o los hubs. `unknown` ≠ `none` en los tres tipos (`ParcelLoadKind`, `InsuranceState`,
  `OccupancyBand`).
- **Backlog derivado, no reinventado**: `max(0, maintenanceDue − maintenanceCost)`, verificado contra
  la política del motor. Los umbrales de riesgo y condición los publica el motor como alertas.
- **Color** en `ui/overlay-color.ts` con `Record<Exclude<MapOverlay,"none">, Resolver>` exhaustivo:
  una capa sin rama es error de compilación, no un fallback silencioso al color de propiedad. Las 15
  ramas existentes se movieron 1:1 y su paridad está testeada.
- **Registro de glifos serializable** (`ui/icons.tsx`): los 55 glifos pasaron de fragmentos React a
  descriptores (`GlyphPrimitive[]`) de los que salen **a la vez** `UiIcon` y `glyphSvgMarkup`. Se
  rechazó `react-dom/server` en el navegador por medida, no por gusto. Un fixture dorado
  (`ui/icon-parity.fixture.json`) compara byte a byte los 55 iconos anteriores a la conversión.
- **Marcas** en módulos puros separados (`isometric/parcel-marks.ts`, `isometric/building-marks.ts`)
  con plan + `reconcile` idempotente. La placa usa la esquina con frente vial; la marca de fachada se
  ancla junto al rótulo con desplazamiento propio y no toca el contrato de `building-signage.ts`.
- **Picking**: la placa **no** crea `Zone`; el hover es hit-test manual y el click atraviesa al picking
  de suelo, que selecciona la parcela. Los badges conservan su `Zone` 28×28 ya probada.
- **Routing**: `resolvePanelTab` puro + token monotónico por click; la pestaña no se queda obsoleta al
  pulsar dos veces el mismo edificio ni al cambiar de él.
- **Firma de reconciliación** `worldIndicatorSignature` con todos los campos visuales (key, kind,
  crítico, glifo, tono, etiqueta, detalle, sección, celda).

## 6. Invariantes del ciclo de vida del seguro (S0.4)

`packages/simulation/src/insurance-lifecycle.test.ts`, 7 tests, un solo escenario determinista que
recorre la cadena completa: `póliza active → siniestro cubierto → claim → colapso → ruina → contrato
terminado en el mismo tick → ninguna prima posterior → claim intacto → clear_ruin → edificio y contrato
desaparecen → claim intacto`.

| # | Invariante | Cubierta por |
| --- | --- | --- |
| 1 | ruina sin póliza `active` | cadena + variante `lapsed` |
| 2 | contrato no `active` ⇒ `nextPremiumTick === null` | cadena |
| 3 | `clear_ruin` ⇒ ningún contrato con `buildingId` inexistente | cadena + ruina sin póliza |
| 4 | el claim del incidente se conserva | cadena (antes y después del desescombro) |
| 5 | ninguna prima después de la ruina | test de flujo de caja tick a tick |
| 6 | save/load conserva 1–5 | test de ida y vuelta |
| 7 | sin deriva canónica más allá de la corrección deliberada | atribución de digestos (§8) |

Casos adicionales: `cancelled → clear_ruin`, ruina sin póliza (no-op), dos edificios en la misma parcela
(colapsa uno, el otro conserva su póliza) y el forecast deja de inflarse con la prima de la ruina.

## 7. Contratos de proyección añadidos

Aditivos, con tipo + zod + productor en el mismo commit y sin estado canónico:
`alerts[].reason`, `alerts[].buildingId`, `tenants[].marketDistrictId` (necesario para filtrar el
mercado de inquilinos por distrito sin adivinar). **Cero migración de snapshot**: `cancelled` ya
existía en el enum y las alertas nunca se persisten.

## 8. Atribución de digests dorados

Protocolo del propio `tick-conservation.test.ts`: enumerar qué digestos se mueven y atribuir el delta
al canal pretendido. Medido en la misma build y equipo (`vd-ux-s-s04-attribution-2026-11-16.json`).

| Digesto | Antes de E3 | Después de E3 | Atribución |
| --- | --- | --- | --- |
| `scenario:seed-1:1200` · `seed-7:1200` · `seed-42:1200` · `seed-1:36000` | ef96c6a5… · 5f72eef3… · 741c3a54… · 2e2894b6… | idénticos | sin colapso: canal intacto |
| `city:50-parcels:1300-ticks` · `city:50-parcels:month-boundary` · `city:200-parcels:month-boundary` | b2d86b0e… · 3e7eab4f… · d8ef8bba… | idénticos | sin colapso |
| `city:50-parcels:fire-cascade` | `1090bb1a3265dc15` | `aed0d8cbb1d9e83d` | **canal E3**: contrato terminado en la ruina |
| `city:200-parcels:fire-cascade` | `8e8756e544a59d94` | `4c578210fadfb7b0` | **canal E3** |
| `city:800-parcels:fire-cascade` | `995f6585244544bf` | `0ca63299836e1e63` | **canal E3** |

El delta se confina exactamente a los tres escenarios que llegan a colapso y explosión; los siete sin
colapso son byte a byte idénticos. **S0.5 no movió ninguno** (los diez idénticos antes/después,
`vd-ux-s-s05-audit-2026-11-16.json`).

Los valores comprometidos en `GOLDEN_CASES` **no se regeneraron**: ya derivaban antes de E3 por deuda
preexistente documentada en el propio test desde 2026-11-03 (0/10 recuperados al neutralizar el censo
nuevo de inquilinos, medido en S0.1). Regenerarlos aquí mezclaría una deriva sin explicar con el delta
atribuido. Los valores posteriores a E3 y S0.5 quedan registrados en el JSON de atribución para que la
regeneración de V.l.6 pueda separar ambas componentes.

## 9. Evidencia Nivel A (navegador) y Nivel B (motor real)

- **Nivel A** — `pnpm smoke:vd-ux-status` (`scripts/vd-ux-status-capture.mjs`): 14 pasos, 50
  aserciones registradas (46 bloqueantes verdes, 4 notas no bloqueantes que declaran los límites del
  instrumento de §10), **0 errores de página**, 13 capturas en `docs/art/golden/vd-ux-status/`.
  Pausa la simulación (si no, el worker sobrescribe la proyección inyectada) y espera `assetsReady`,
  medido en 14 041 ms. Cubre: los seis estados sembrados; tiers 0.5/0.7/0.85/1/2 con la regla
  «en zoom lejano sólo sobreviven los críticos» (2 visibles de 7, ambos tier 1); glifos rasterizados
  (12 texturas, tope 70); **hover real** de badge y de placa con tooltip en español y detalle plegado
  (4 líneas en el badge de condición; sin ids ni ticks crudos en la placa); colisión espacial en la
  misma manzana; cinco inyecciones idénticas sin
  duplicación (7/4/2 estables); mutación sólo económica sin re-horne del suelo (2→2) y placa que pasa a
  `delinquent` sin recrearse; las tres capas con leyenda (7/7/5 entradas) y vuelta a vista normal en
  modo día; remount día/noche reconciliado; `prefers-reduced-motion` con `statusTweens` 0 y los
  marcadores idénticos (46 GameObjects), y `statusTweens` 2 al desactivar la guarda; churn de zoom ×10
  con 2 tweens; y las métricas de peor caso (§10).
- **Nivel B** — `apps/web/src/ui/asset-status.test.ts`, dos cadenas con **motor real** (nada de
  proyección fabricada): (1) `BuyParcel → RequestLoan → AcceptLoanOffer` con `runScenario`,
  `createViewProjection` e `indexAssetStatus`, que termina en `kind: "loan"`, un préstamo vivo de
  600 u. y `assetMortgageTotal` 600; (2) una ciudad del motor tras 36 000 ticks reales, donde **todas**
  las parcelas y edificios no propios llegan como `unknown` y ninguno aparece en
  `deriveWorldIndicators` — la información imperfecta verificada con datos del motor, no autorados—.
- **Desviación declarada frente al plan §3.2.** La tabla del plan pedía siete estados producidos con
  comandos y ticks. Se cubren con motor real: `loan active` y el caso rival (cadena completa en web),
  y `insurance active → siniestro → colapso → ruina → clear_ruin`, atraso/impago y backlog en
  `packages/simulation` (`insurance-lifecycle.test.ts`, `phase2.test.ts`), que ya afirman el estado
  canónico y su efecto proyectado. Los estados `delinquent`, `lapsed`, `vacancy`, `upgraded` y backlog
  **no** tienen cadena web hasta el indicador: requieren receta de construcción o drenaje de caja
  (varios miles de ticks cada uno) y aquí se verifican con fixtures de la puerta y con los tests de
  dominio. Queda declarado, no silenciado: es la única casilla de §3.2 que no se cerró y decide el
  responsable.
- El routing badge → pestaña **no** es verificable en la captura (la proyección inyectada no llega a la
  economía de React); se prueba con DOM real en `apps/web/src/ui/panels-routing.test.tsx` (happy-dom),
  que cubre la matriz de transición, el token ya consumido y el cambio de edificio.

## 10. Métricas de peor caso (§3.3 del plan)

Brazo de control: **la misma ciudad sembrada, idéntica geometría, sin ningún disparador del idioma de
estado** (préstamos, subastas, pólizas, alertas, `upgraded`, backlog, condición y obra sin cuadrilla
neutralizados). El delta mide sólo los marcadores. 3 pasadas por brazo y zoom agrupadas: 15 s de
medición + 3 s de calentamiento, con muestreo de frame time cuadro a cuadro además de las ventanas de
500 ms del motor. Corrida completa: `pnpm smoke:vd-ux-status` (HEAD `0d97d3a`).

| Zoom | Brazo | FPS p50 / p95 | frame media | p50 | p90 | p95 | p99 | peor | frames |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1.0 | control | 12 / 13 | 81,94 ms | 83,3 | 83,4 | 100,0 | 100,1 | 166,7 | 551 |
| 1.0 | **status** | 12 / 13 | 82,39 ms | 83,3 | 99,9 | 100,0 | 133,3 | 149,9 | 548 |
| 1.0 | delta | 0 % / 0 % | **+0,5 %** | **0 %** | +19,8 % | **0 %** | +33,2 % | −10,1 % | — |
| 2.0 | control | 11 / 11 | 94,29 ms | 99,9 | 100,1 | 100,1 | 116,7 | 133,3 | 479 |
| 2.0 | **status** | 11 / 11 | 93,09 ms | 99,9 | 100,0 | 100,1 | 116,7 | 133,4 | 485 |
| 2.0 | delta | 0 % / 0 % | **−1,3 %** | **0 %** | −0,1 % | **0 %** | 0 % | +0,1 % | — |

Objetos añadidos, medidos sobre el display list real (`statusGameObjects`, porque badges y placas viven
en capas contenedoras y `sceneChildren` no los cuenta): **+46 GameObjects exactos** en ambos zooms =
7 badges × 4 (contenedor + forma + glifo + zona) + 4 placas × 3 + 2 marcas de fachada × 3, con
12 texturas de glifo y 2 tweens de pulso. Topes respetados: 7 ≤ 12 badges, 4 ≤ 12 placas, 2 ≤ 12 marcas.

**Lectura.** p50 y p95 idénticos en los dos zooms y media dentro del ruido (+0,5 % y −1,3 %): el coste
de pintar el idioma de estado no es medible aquí. La cola en zoom 1 sube **un paso de cuantización**
(p99 100,1→133,3 ms; frames >1,5×p50 de 2 a 6 sobre 548), y eso es exactamente lo que significa una
muestra más: con ~550 frames y deltas anclados a la cadencia del compositor en pasos de 16,7 ms, un
cuadro saltado más ya lee como +20 % o +33 %. En zoom 2 la cola es idéntica (0 hitches en ambos brazos).

**Límites declarados del instrumento — dos, no uno.** (1) El cuantún del medidor de FPS es 8,3–9,1 %
(12 y 11 FPS por software, sin GPU accesible), por encima del presupuesto del 5 %: el criterio de FPS
**no es evaluable aquí**. (2) Por la cuantización de los deltas, los percentiles de cola tampoco
resuelven un 5 %. Los dos quedan registrados como **notas no bloqueantes** en la evidencia (3 de 4
notas en verde/rojo según zoom, nunca como PASS) y se certificarán en el playtest humano con GPU, donde
ya está declarado el P1-1 de V.d-7C.



## 11. Gates medidos

Comandos con `PATH` saneado (la memoria de entorno sigue vigente: las entradas del SSD desconectado
rompen cualquier spawn por nombre). HEAD de código `0d97d3a` + los cambios de S6.

| Gate | Comando | Resultado |
| --- | --- | --- |
| typecheck | `pnpm typecheck` | **pass** en los 3 paquetes |
| lint | `pnpm lint` | **pass**: eslint 0 errores / 0 advertencias + `check-architecture` verde |
| format | `pnpm format:check` | **pass para los 21 archivos de la fase** (aplicado en S6); queda 1 ofensor **ajeno y preexistente**: `blender_artist/manifests/building-composer-grammars.json`, declarado sin tocarlo |
| shared | `pnpm --filter @landlord/shared test` | 80 passed / 0 failed |
| web | `pnpm --filter @landlord/web test` | **381 passed · 4 skipped** (42 archivos, 1 skipped) · 0 fallos |
| simulation | `pnpm --filter @landlord/simulation test` | **8 failed · 604 passed · 20 skipped** — exactamente el conjunto preexistente de la foto de baseline (`city-seeds`, `district-generation`, `market-actionability`, `tick-conservation`, `urban-civic` y los tres `vd7a-multiparcel`); **0 regresiones** y el fallo `phase2 > enforces unit capacity` de S0.1 ya no aparece |
| paridad de glifos | `icon-parity.test.tsx` | los **55** glifos anteriores a la conversión, byte a byte |
| paridad leyenda↔color | `overlay-catalog.test.ts` · `overlay-color.test.ts` | verde, incluidas las 15 capas previas movidas 1:1 |
| invariantes de ciclo de vida | `insurance-lifecycle.test.ts` | 7/7 |
| audit S0.5 | `building-reference-lifecycle.test.ts` | 7/7 |
| Nivel B | `asset-status.test.ts` | 2 cadenas con motor real (préstamo y rival) |
| contrato de proyección | `projection.test.ts` (`keyPaths`) | verde: tipo, zod y productor alineados |
| bundle | `pnpm --filter @landlord/web build` | 2 429 572 B raw / 599 651 B gzip en 4 chunks; **sin** `react-dom/server` y sin chunk lazy nuevo |
| Nivel A | `pnpm smoke:vd-ux-status` | 14 pasos, 46 aserciones bloqueantes verdes, **0 errores de página**, 13 capturas; ver §9 y §10 |


## 12. Correcciones del plan por medida

- El plan afirmaba «54 glifos»; el registro medido son **55** (más 3 nuevos = 58). El fixture de
  paridad cubre los 55 anteriores.
- El plan afirmaba que no existían tests de digesto dorado; sí existe
  `tick-conservation.test.ts` con protocolo de regeneración deliberada, y se usó.
- La atribución inicial («la deriva del digesto viene del trabajo de mercado de inquilinos») fue
  **falsa y se midió**: truncando `PROTOTYPE_TENANTS` a los 4 hogares originales se recuperan 0/10
  valores; la deriva es deuda de baseline desde 2026-11-03. Por eso los digests no se regeneraron.
- `groundRebakes === 1` no es una aserción válida para un escenario que cambia propiedad y edificios;
  se sustituyó por la invariante real: una mutación **sólo económica** no re-hornea el suelo.
- `react-dom/server` se midió antes de decidir (268 058 B de módulo frente al bundle); rechazado con
  evidencia, no por preferencia.

## 13. Deuda declarada (no arreglada en esta fase)

- `assetsReady` tarda ~14 s por registro secuencial de texturas; `scripts/vd-ux-smoke.mjs` falla en el
  fantasma de colocación por esa razón (reproducido con el árbol de la fase revertido).
- Una escena remontada con la simulación pausada no recibe la proyección: el efecto que la entrega
  depende sólo de `[projection]` (`apps/web/src/App.tsx:1118-1120`) y `updateIsometricProjection`
  escribe en `mountedScenes` antes de que la escena se registre. La evidencia lo sortea reanudando un
  instante.
- Presupuesto de FPS en GPU real (§10).
- Los claims siguen filtrándose por existencia del edificio en la proyección: tras el desescombro
  dejan de ser visibles aunque el estado los conserve.
- 8 fallos de simulación preexistentes (foto en `vd-ux-s-baseline-2026-11-16.json`).
- Sin sonido nuevo: badges y placas son lectura pasiva; el único comando nuevo ya suena con los cues
  existentes.

Ver `ai-context/KNOWN-GAPS.md` (sección V.d-UX.S).

## 14. Autoevaluación visual honesta de la evidencia

Lectura propia de las 13 capturas, sin concederse PASS. Lo que se ve bien y lo que queda como punto
de decisión del responsable:

- **Funciona.** En `zoom-0_5` sólo sobreviven los dos tier 1 y el mapa no se llena de iconos: la regla
  anti-clutter se ve cumplida, no sólo afirmada. En `zoom-1` y `zoom-2` badge, placa, marca y rótulo
  conviven en la misma manzana sin solaparse (los anclajes separados cumplen su función) y los glifos
  se leen con la tinta clara sobre las placas oscuras.
- **Dudoso: placa vs badge.** A zoom 2 la placa apaisada y el badge crítico tienen silueta parecida
  (cuadrado con borde oscuro); la diferencia real recae en tamaño y ausencia de puntero, no en la
  forma «apaisada» que plantea §9.2. Es el punto débil del lenguaje y se decide en la revisión humana:
  o se aplana más la placa, o se le quita el borde tipo badge.
- **Dudoso: el glifo `lien`.** A 12 px se lee como una llave, no como un sello de gravamen. El glifo
  es correcto como dato (casa + candado) pero su lectura a ese tamaño es pobre; candidato a rediseño
  dentro del mismo registro, sin tocar la semántica.
- **Dudoso: relleno de las capas en modo día.** En `overlay-ocupación` y `overlay-cargas` el **borde**
  de la banda se distingue, el **relleno** apenas: sobre el terreno de tierra y césped del día, el
  alpha del tinte queda por debajo de lo necesario. La paridad leyenda↔color está probada por test,
  así que el problema es de intensidad de pintura, no de datos. Se declara como ajuste visual
  pendiente de aprobación, no como defecto de la puerta.
- **Correcto pero redundante:** el tooltip de la placa repite el estado en sus dos líneas
  (`hipoteca al día` / `al día · 600 u. pendientes · cuota 55 u./mes · 12 meses restantes`). El
  detalle está bien (cifras, sin ids ni ticks crudos), pero la primera palabra sobra. Se corrige en
  la etiqueta de la puerta si el responsable quiere cerrarlo ahora; no altera ninguna regla.
- **Correcto pero extraño:** el badge de subasta de una parcela sin edificar flota en medio del solar
  (es su contrato: la carga es de la parcela, no de un edificio). Es exacto y a la vez poco natural a
  la vista; si el responsable prefiere anclarlo al borde de parcela, es un cambio de presentación.
- **No evaluable aquí:** la suavidad real del pulso y del destello. Con 11–13 FPS por software, la
  animación no puede juzgarse; sólo puede afirmarse que existe, que es render-time y que se apaga con
  `prefers-reduced-motion` (medido: 2 tweens → 0).

## 15. Pendiente humano

1. Revisión visual de las 13 capturas de `docs/art/golden/vd-ux-status/`, con los cuatro puntos de
   decisión de §14 (placa vs badge, lectura del glifo `lien`, intensidad de relleno de las capas en
   día, anclaje del badge de parcela vacía).
2. Playtest humano de V.d (30–60 min), que arrastra la certificación de FPS y el P1-1 de V.d-7C.
3. Decisión sobre la casilla de §3.2 que no se cerró (§9: estados con cadena web hasta el indicador).
4. Decisión de push: los commits locales de la fase esperan cierre de fase.

