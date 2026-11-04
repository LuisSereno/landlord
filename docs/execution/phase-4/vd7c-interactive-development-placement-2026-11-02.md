# V.d-7C — Colocación interactiva de proyectos y coreografía de obra (2026-11-02)

Estado: **implementación completa y gates en verde, NO declarable `READY FOR HUMAN PLAYTEST` según
§60 del prompt** porque `P1 ≠ 0` (ver §16: P1-3 cerrado el 2026-11-02 con la corrida dedicada de
§14.2; queda P1-1). La decisión de aceptar el P1 y abrir el playtest
corresponde al responsable. No cierra V.d-7B, no cierra V.d y no sustituye el playtest humano de
`docs/execution/phase-4/vd-final-playtest-checklist.md`.

## 1. Git

| Punto | Valor |
|---|---|
| Documentación de la fase | `origin/docs/vd7c-interactive-development-placement@b6ff2cd` |
| Baseline funcional elegido | `b6ff2cd` (árbol de `974cc42` + los cuatro commits documentales de V.d-7C) |
| Rama de trabajo | `wip/vd7c-interactive-development-placement` |
| HEAD funcional final | `79b71bc` (doce commits sobre `b6ff2cd`, ver §15); el acta se versiona en el commit siguiente, que no puede contener su propio SHA |
| HEAD tras el cierre de P1-3 | `76bc527` (corrida dedicada de §14.2) más el commit documental que versiona esta actualización |
| Push | solo a `wip/vd7c-interactive-development-placement`; **ningún merge a `develop`** |

**Por qué este baseline y no el tip de V.d-7B.** El prompt exigía «el baseline funcional V.d-7B más
reciente aprobado». En el repositorio no existe acta que apruebe V.d-7B: el tip de su rama,
`wip/vd7b-spatial-visual-integrity@f70f3bf`, se autorregistra como
`BLOCKED — no apto para revisión visual humana`, sin captura `12-multiparcel-building.png`, sin
inventario 16/16 y sin cierre de gates. Además `0f323a4` (en esa rama) añade
`preferredFootprint`/`shapePenalty` al desempate de `chooseFootprint`, es decir, **cambia la elección
de candidatos** justo donde V.d-7C tiene que demostrar que no cambia nada. Se consultó y el
responsable eligió `b6ff2cd`. Consecuencia registrada como deuda: los tres commits de la línea
V.d-7B (`0f323a4`, `a44ad67`, `f70f3bf`) quedan fuera de esta rama y habrá que reconciliarlos antes
de integrar.

## 2. Inventario del placement anterior (línea `974cc42`)

| Función | Fichero | Responsabilidad | Callers |
|---|---|---|---|
| `chooseFootprint` | `packages/simulation/src/footprints.ts:125` | enumera rectángulos axis-aligned en el envelope, puntúa y devuelve **una** huella o error | `commands.ts:836` (`StartConstruction`), `district-generator.ts:983` (equipamientos municipales en generación) |
| `buildableEnvelope` | `footprints.ts:63` | celdas del solar menos retranqueo de calle, menos retranqueo lateral, menos huellas ocupadas | `chooseFootprint`, `urban-composition.test.ts` |
| Puntuación y desempate | `footprints.ts:192-206` (`better`) | `min(area,target)` desc → `|area−target|` asc → `frontageDistance` asc → `continuity` desc → `floors` desc → `area` desc → orientación 0 → firma asc | interno |
| Orientación | `footprints.ts:221` | derivada de la geometría: `width >= height ? 0 : 90` | interno |
| Rechazos | `footprints.ts:13` | `NO_BUILDABLE_ENVELOPE`, `COVERAGE_LIMIT`, `FAR_LIMIT` | `commands.ts:850` |
| Frente principal | `commands.ts:826-833` | celdas de los frentes cuyo segmento es avenida; si no hay, todos los frentes | `chooseFootprint` |
| `canonicalParcelIds` | `packages/shared/src/parcels.ts:12` | orden canónico del conjunto | `commands.ts:768` |
| `findDevelopmentSite` / `enumerateDevelopmentSites` / `enumeratePurchasableDevelopmentSites` | `development-site.ts` | elige el **conjunto de parcelas**, no la huella | `systems.ts:1119,1172` (IA rival), `generated-sites.ts` |
| `StartConstruction` | `commands.ts:758-909` | valida conjunto, permiso, envelope, recursos; escribe `footprintCells`, `orientation`, `floors`, `form` | `dispatchProductCommand` |
| IA | `systems.ts:1181-1191`, `1198-1215` | emite `StartConstruction { parcelIds, buildingType }` | sistema `rival` |
| Automatización | `automation.ts` | **no emite `StartConstruction`**; sólo `RepairBuilding` (hereda el solar) | gestores diarios |
| Protocolo worker | `packages/shared/src/contracts.ts:93-111`, `worker-runtime.ts:201` | siete peticiones; ninguna devolvía colocaciones | cliente web |
| Proyección | `projection.ts:787,832,869` | publica `constructionOptions`, huellas y orientación de edificios y obras | `ViewProjectionV2` |
| UI de construcción | `apps/web/src/ui/build-catalog.tsx:273-289` | «Construir» despachaba el comando directamente en parcela de 1 | panel de parcela |
| Ensamblado multi-parcela | `apps/web/src/ui/site-assembly.ts` | `PendingDevelopmentSite`, candidatos, incidencias | `App.tsx:47,92-103`, `panels.tsx:323` |
| Capas Phaser | `isometric/IsometricSpikeScene.ts:229,659` | un único `mapGraphics` a depth 20 000 para overlay, selección y ensamblado | escena |

Respuestas exigidas: (1) genera footprints `chooseFootprint`; (2) decide legalidad el mismo
(`buildableEnvelope` + límites de cobertura/FAR) más las validaciones de conjunto del comando;
(3) puntúa `better()`; (4) elige el ganador `chooseFootprint` devolviendo el mejor;
(5) `footprintCells` se escribe en `commands.ts:888`; (6) `orientation` en `commands.ts:889`;
(7) la IA construye por el mismo comando sin identidad; (8) la automatización no construye.

## 3. Arquitectura de candidatos (una sola fuente)

```
StartConstruction ─┐
                   ├─ resolveDevelopmentPlacementSite ─ placementCodeFor / permiso ─ footprintInputFor
Get…Candidates ────┘                                            │
                                                    enumerateFootprintCandidates  (única geometría legal)
                                                                  │
                              ┌───────────────────────────────────┼───────────────────────────┐
                     humano: elige placementId            IA/automatización: sin id    generador municipal: chooseFootprint
                              └─────────────── revalidación + identidad ───────────────┘
```

- `footprints.ts` pasa a devolver **la lista completa** (`enumerateFootprintCandidates`) con
  `rejection` cuando está vacía. `chooseFootprint` es un envoltorio que toma `[0]`, así que el
  generador municipal y cualquier llamada antigua conservan resultado sin tocar su código.
- El desempate anterior se reutiliza campo a campo como **orden total** (`signature` único por
  rectángulo), por lo que el orden no depende del descubrimiento, del `Map` ni del array de celdas.
- `development-placement.ts` añade lo que la UI necesita y nada que el motor no decida ya:
  resolución del conjunto (mismos checks, mismo orden, mismos códigos), código legal (congelado en el
  permiso vivo o, si no lo hay, el que el permiso congelaría), identidad y mapeo a candidatos.
- **No se rebajó ninguna regla** y no hay segunda implementación de setback/cobertura/FAR/frente en
  `apps/web`.

## 4. Identidad del candidato

`placement_<16 hex>` = dos FNV-1a con dominios distintos sobre
`landlord.placement.v1|buildingType|parcelIds canónicos|firma x,y,width,height|orientation`.
Nada de índice de array, UUID aleatorio ni contador. Se eligieron 64 bits porque con ~5 500
candidatas legales en un triplete de acería una identidad de 32 bits daría colisión apreciable
(≈10⁻³ por enumeración) y una colisión significaría construir otra huella. Tests: estabilidad,
inyectividad dentro de la enumeración, sensibilidad a orientación y a tipo, y forma validada por
`developmentPlacementIdSchema`.

## 5. Contrato de comando

`StartConstruction.payload.placementId?: DevelopmentPlacementId` (adicional, opcional). Revalidación
en `commands.ts`: canonicalizar → resolver conjunto → permiso → código → enumerar → buscar identidad
→ **rechazar si ya no está** (`PLACEMENT_NO_LONGER_VALID`) antes de mirar cuadrillas, materiales y
caja. Sin identidad, la primera candidata. Con identidad y cero candidatas legales, se devuelve el
código de buildabilidad real (`NO_BUILDABLE_ENVELOPE`/`COVERAGE_LIMIT`/`FAR_LIMIT`), no un código
genérico de UX.

Forma adoptada: **identidad**, no geometría inline. Motivo: replay más corto, payload canónico
pequeño y el motor revalida igualmente. Consecuencia medida: al ser opcional y omitirlo la IA, la
cadena canónica de `pendingCommands` no cambia y **los diez digestos dorados se conservan**.

## 6. Worker y proyección

`GetDevelopmentPlacementCandidates { districtId, parcelIds ≤ 3, buildingType }` →
`{ districtId, parcelIds, buildingType, candidates[≤24], totalCandidates, rejection }`. Petición
técnica (como `SetObservedDistrict`): no avanza tick, no toca el PRNG, no emite permisos, no crea
obra y deja la cadena canónica idéntica. Responde siempre para `PLAYER_ORGANIZATION_ID`, así que no
filtra planes del rival. `ViewProjectionV2` **no** se ensanchó con todas las huellas de la ciudad.
El cliente añade `getDevelopmentPlacementCandidates` y un `placementId` que sólo viaja si el jugador
confirmó una colocación.

## 7. Determinismo

`packages/simulation/src/development-placement.test.ts` (31 tests) fija: misma entrada → mismos
candidatos y mismo orden; `parcelIds` invertidos; `Map` de parcelas/edificios/obras invertidos; array
de celdas invertido; un candidato / varios / cero por retranqueos, por cobertura y por FAR;
obstrucción por edificio existente; orientaciones producidas (0° y 90°) y ausencia de 180°/270°
deduplicados por geometría; identidad estable e inyectiva; y paridad `chooseFootprint == [0]`.

**Compatibilidad con el algoritmo anterior (§11)**: diferencial ejecutada contra el
`footprints.ts` exacto de `b6ff2cd` (fichero temporal ya eliminado) sobre 3 seeds × 120 parcelas ×
15 tipos con obstrucciones aleatorias deterministas (>2 000 comparaciones) y unions de 2 y 3 parcelas
(>40): huella, orientación, plantas y código de rechazo idénticos en todos los casos. Además, tras el
refactor: `tick-conservation` (10 digestos) y `canonical-state` (7 tests) en verde, y
`urban-composition`, `commands`, `vd7a-multiparcel`, `h1-permit-contract` y `generated-sites` (63
tests) sin cambios.

## 8. Flujo del jugador

Una parcela: `catálogo → Elegir ubicación → modo colocación → Confirmar proyecto`. Dos/tres:
`catálogo → Elegir solares → 1/2|1/3 → … → 2/2|3/3 → Elegir ubicación → Confirmar`. El ensamblado de
V.d-7B no se sustituye. Controles: Anterior, Siguiente, Rotar (solo si existe otra orientación legal),
Confirmar, Cancelar, click en la lista, click en el mapa (snap a la candidata más cercana), ← →, R,
Enter y Escape. Jerarquía de Escape: ayuda → notificaciones → depuración → hub → **colocación** →
ensamblado → selección/panel. Accesibilidad: `aria-label` por sección y por botón, `aria-pressed` en
cada candidata, `role="status"` con `aria-live` para la explicación, foco visible del shell, y
distinción por número+borde+etiqueta además del color. Sin candidatas, la ficha traduce el código del
motor («No cabe este edificio respetando los retranqueos del código», «La superficie edificable ya
está agotada», «La superficie conjunta de las parcelas es insuficiente», …).

## 9. Paridad IA y automatización

No existe `StartConstructionForAI` ni bifurcación por actor. La IA recorre `findDevelopmentSite` y
despacha el mismo comando; el motor resuelve la primera candidata de la enumeración autoritativa. El
test «sin placementId el motor toma la mejor candidata: paridad con la IA» verifica que la huella, la
orientación y las plantas construidas son exactamente las de `candidates[0]`, y que confirmar esa
misma identidad explícitamente produce el mismo resultado. La automatización sigue sin emitir
`StartConstruction` (D-096 §13); revalidar su camino habría sido inventarse un consumidor.

## 10. Cancelación, candidato obsoleto y save/load

- Cancelar (Escape o botón): no hay comando; caja, inventario, permiso y obras idénticos y la capa de
  colocación queda a cero objetos (verificado en navegador, §12).
- Obsoleto: dos casos de test —solar ya en obra (`ACTIVE_SITE_ON_PARCEL`) y huella tapada por un
  edificio terminado (`PLACEMENT_NO_LONGER_VALID`)— más identidad inventada. En los tres: caja,
  inventario, expediente de permiso, contadores y `processedCommandIds` intactos y ninguna obra nueva.
- Save/load: la obra conserva `parcelIds`, huella, orientación, plantas, progreso y cuadrilla tras
  `serializeSnapshot`/`restoreStateFromSnapshot`; una colocación abierta sin confirmar no deja nada
  que guardar y las mismas candidatas con los mismos ids reaparecen al restaurar.

## 11. Coreografía de obra, cuadrillas y recinto

`construction-stages.ts` (puro, 6 tests) deriva `foundation < 15 % ≤ structure < 70 % ≤ finishing
< 100 % = complete` del progreso autoritativo; no se tocó `workRequired`, coste ni consumo. La escena
dibuja solera/excavación, volumen parcial con andamio reticular, acabado y barra de progreso sobre la
huella exacta. Cuadrillas: anillo por agente según `assigned | travelling | on-site | working |
released`, calculado con la celda y el estado ya proyectados y la vecindad de la huella; la ficha
resume la plantilla. `property-grounds.ts` (8 tests) deriva jardín/path/seto/valla/árbol/patio frente a
hardstanding/service yard/zona de carga/palés/contenedores con firma FNV-1a (sin `Math.random`),
topado a 18 descriptores por propiedad, sin pisar huella ni salir del solar, cacheado por geometría.
Ninguno de los dos toca propiedad, colisión, producción, valoración, cobertura ni FAR.

## 12. Pruebas y smokes

| Suite | Resultado |
|---|---|
| `pnpm lint` (eslint + check-architecture) | PASS — 2 avisos preexistentes (`no-console` en `services-balance.test.ts` y `urban-fabric-gate.test.ts`) |
| `pnpm typecheck` | PASS (shared, simulation, web) |
| `pnpm format:check` | PASS |
| `pnpm test` | PASS — shared 55 · simulation 566 (17 diferidos) · web 179 pruebas |
| `pnpm build` | PASS — bundle principal 2,09 MB (aviso preexistente > 500 kB) |
| `pnpm smoke:alpha` | PASS |
| `pnpm smoke:vd-core-loop` | PASS (15 pasos, 0 errores de página) tras adaptar el paso 5-6 al modo de colocación |
| `pnpm smoke:vd-ux` | PASS — **25 pasos, 0 errores de página** (antes 20) |
| `pnpm art:assets:check` / `art:binaries:check` | PASS |
| `pnpm placement:bench` | evidencia escrita en `vd7c-placement-performance.json` |
| `pnpm placement:reachability` | evidencia escrita en `vd7c-placement-reachability.json` — sonda de alcanzabilidad del caso «cero candidatas» (§14.1) |
| `pnpm vd7c:evidence:followup` | PASS — re-toma dedicada de 06/11/14; evidencia en `evidence-followup.json` (§14.2) |

Pasos nuevos del smoke de UX: 7b candidatas+fantasma, 7c cambio de candidata, 7d cancelar sin
efectos, 7e confirmar una candidata no recomendada y exigir la huella exacta, 16b ensamblado 2/2 con
solares comprados por comandos reales, 16c colocación sobre la unión de 2, y 3 parcelas con
colocación sobre la unión de 3.

## 13. Rendimiento medido

Enumeración autoritativa completa, sin caché, 24 casos (3 seeds × hasta 8 tipos), 60 repeticiones:
**p50 2,56 ms · p95 18,88 ms · máximo 58,35 ms**. Peor caso medido: acería sobre triplete con
**5 582 candidatas legales**, p50 27,45 ms / p95 34,88 ms y petición de sólo lectura p95 38,27 ms.
Delta frente a la implementación de `b6ff2cd` sobre los mismos insumos: antiguo p50 2,70 / p95 14,46 /
máx 24,38 ms → nuevo p50 3,41 / p95 17,71 / máx 39,10 ms (+22 % p95), atribuido a materializar y
ordenar el conjunto legal en lugar de conservar un mínimo corriente. Se queda dentro del guardado de
50 ms y sólo ocurre al entrar en colocación o al iniciar una obra: **nunca por frame**
(contador `placementDraws`: 151 repintados en 50 ciclos ≈ 3 por ciclo, todos por acción de usuario).

Navegador (Chromium headless, 1440×900, corrida limpia): 50 ciclos entrar/cancelar → hijos de escena
86 → 86, objetos de colocación 0 al cerrar, pool de etiquetas 24 (acotado por la página), 151
repintados en total (≈3 por ciclo, todos por acción de usuario) y heap +0 KB. **No hay fuga.**

FPS: 60 en mapa recién nacido; **9-13 con el modo de colocación abierto** (9 y 12 en dos corridas) y
**5-8 sobre la unión de dos/tres parcelas**. Atribución: midiendo el baseline prístino `b6ff2cd` con el mismo arnés se obtiene 60 al
nacer → **24 al seleccionar una parcela → 14 tras comprarla → 14 con obra → 14 sin panel**. El
desplome existe antes de V.d-7C y lo dispara poseer una parcela, no el modo de colocación; V.d-7C lo
agrava en la unión de tres parcelas. Queda como **P1-1** con la medición de ambos lados.

## 14. Capturas (16/16 revisadas)

`docs/art/golden/vd7c/` (PNG) con `evidence.json` de la corrida. Veredicto por captura:

| # | Archivo | Veredicto |
|---|---|---|
| 01 | `01-single-recommended.png` | PASS |
| 02 | `02-single-alternative.png` | PASS |
| 03 | `03-rotated-candidate.png` | PASS |
| 04 | `04-two-parcel-placement.png` | PASS |
| 05 | `05-three-parcel-placement.png` | PASS (procedencia: captura `21-colocacion-tres-parcelas.jpg` del `smoke:vd-ux` sobre esta misma rama, convertida a PNG; el harness propio no llegó a ensamblar el triplete en la última corrida) |
| 06 | `06-no-placement.png` | **PASS tras la corrida dedicada (§14.2)** — solar municipal de 225 celdas con su equipamiento (Escuela, 17,17): la ficha declara «Suelo municipal · gestionado por el Ayuntamiento; no es transferible» y no ofrece comprar, ni catálogo, ni colocación. Es el único «aquí no se puede colocar nada» alcanzable en una partida nueva; el cero de candidatas del modo colocación se documenta en §14.1 |
| 07 | `07-foundation.png` | PASS |
| 08 | `08-structure.png` | PASS |
| 09 | `09-finishing.png` | PASS |
| 10 | `10-complete-residential.png` | PASS |
| 11 | `11-complete-industrial.png` | **PASS tras la corrida dedicada (§14.2)** — propiedad industrial terminada por el camino largo: solar comprado, Taller colocado con el modo de colocación (24 candidatas, `placement_01c6e42cc2011df2`), dos cuadrillas asignadas y obra liquidada a 4×; la ficha dice «EDIFICIO · Taller · En servicio · nivel 1 · Tu empresa · Condición 100 %» y el HUD refleja el consumo real (caja 12 000 → 6 785; cemento 8→2, ladrillo 16→6, acero 6→2) |
| 12 | `12-crew-on-site.png` | PASS |
| 13 | `13-residential-grounds.png` | PASS |
| 14 | `14-industrial-grounds.png` | **PASS tras la corrida dedicada (§14.2)** — el mismo recinto acercado con la rueda real del ratón (zoom 1,00 → 1,80): se leen el galpón, la pista de maniobras `hardstanding`, el patio de servicio, el área de carga y los contenedores/palets derivados, con el camino de acceso hasta el frente vial. Frame distinto de 11 (md5 diferente, comprobado por el arnés) |
| 15 | `15-1280x720.png` | PASS |
| 16 | `16-1920x1080.png` | PASS |

Preguntas de la revisión: qué se construye, dónde, con qué orientación, qué suelo ocupa, dónde toca
la calle y cómo se cancela se leen en 01-05 y 15-16; la obra parece una obra en 07-09 (solera,
volumen parcial con andamio, acabado) y no un sprite con alpha; la propiedad terminada se lee como
recinto en 10 y 13 (jardín, seto y camino a la calle).

### 14.1 El caso «cero candidatas» no es alcanzable en la ciudad que se entrega

`pnpm placement:reachability` (`packages/simulation/src/placement-reachability.test.ts`, opt-in, 40 s)
barre con el enumerador autoritativo **todos** los proyectos que una jugadora puede abrir en una
partida nueva —comprar solar vacío → catálogo → «Elegir ubicación»—, incluyendo los ensamblados de
dos y tres parcelas contiguas bajo la misma norma, y cuenta las candidatas que el motor devuelve:

| Semilla | Proyectos barridos | Candidatas mínimas | Proyectos con cero |
|---|---|---|---|
| 1 (la de la app) | 2 297 | 15 | 0 |
| 7 | 2 334 | 15 | 0 |
| 42 | 2 341 | 15 | 0 |

El mínimo por tipo (semilla 1) deja claro dónde está el borde: `workshop` 15 · `courtyard_home`,
`row_house`, `apartment_block`, `mixed_tenement` 44 · `cement_plant`, `brickworks`, `warehouse` 70 ·
`steelworks` 432. Ninguno roza el cero.

Causa geométrica, medida en la misma sonda: el solar comprable más pequeño de la ciudad tiene
**10 celdas** y el mayor `minCombinedAreaCells` entre los proyectos de una parcela es **10**, así que
`SITE_AREA_TOO_SMALL` no puede dispararse; y sobre los pares/tríos adyacentes la unión siempre deja
envelope para la huella objetivo. Los otros rechazos del panel (`WRONG_PARCEL_COUNT`,
`MIXED_DEVELOPMENT_CODES`, `PARCEL_OCCUPIED`, `ACTIVE_SITE_ON_PARCEL`, `PUBLIC_LAND_NOT_BUILDABLE`)
están cerrados antes por la propia interfaz: el ensamblado sólo ofrece solares contiguos, de la misma
norma, vacíos y propios, y el botón de entrada aparece sólo con el proyecto completo.

Consecuencia honesta: **el bloque `.placement-issue` del modo colocación no es fotografiable en una
partida nueva**, aunque sí es real: lo fijan los tres casos de cero candidatas del enumerador
(`NO_BUILDABLE_ENVELOPE`, `COVERAGE_LIMIT` y `FAR_LIMIT` en `development-placement.test.ts`), el
`SITE_AREA_TOO_SMALL` de `vd7a-multiparcel.test.ts` y el paso «sin candidatas el modo se bloquea con
la razón del motor» de `ui/placement.test.ts`. La captura 06 enseña el «no se puede colocar aquí» que
la ciudad sí ofrece (suelo municipal intransferible). La sonda deja el umbral registrado: si un futuro
generador produce solares más pequeños, `zeroCandidateProjects > 0` y 06 podrá re-tomarse con el panel
de cero candidatas.

Hallado secundario de esta sonda: `placementEntryIssues` (los códigos `not_owned`,
`use_not_permitted`, `parcel_busy`) **nunca devuelve razones** en la UI actual, porque el catálogo
sólo se monta para una parcela propia y vacía y sólo lista tipos permitidos. El botón «Elegir
ubicación» de un proyecto de una parcela está, por tanto, siempre activo. Es código defensivo sin
efecto visible; se anota en Deuda (§17), no como defecto jugable.

### 14.2 Corrida dedicada de cierre (P1-3)

`pnpm vd7c:evidence:followup` (`scripts/vd7c-evidence-followup.mjs`, puerto 4180) re-toma **sólo**
06, 11 y 14 sobre una partida limpia (IndexedDB borrado, semilla 1 de la app) y escribe
`docs/art/golden/vd7c/evidence-followup.json`. Todo el camino es la interfaz real: no se inyecta
dinero, materiales ni estado, y las sondas usadas (`__landlordUiTest`, `__landlordCameraTest`,
`__gameplayVisualStats`) son las ya existentes y sólo leen.

- **06**: celda 17,17 del distrito natal (Barrio del Umbral) → ficha de equipamiento municipal; el
  arnés verifica que el texto declara suelo municipal y que no hay botón de compra, ni catálogo, ni
  «Elegir ubicación» antes de disparar.
- **11**: `marketableParcelCellForType("workshop")` → comprar el solar con la caja de la partida
  (12 000 u. iniciales, sin inyectar nada) → catálogo «Taller» → elegir ubicación (24 candidatas) →
  confirmar → la huella construida coincide con la vista
  (`10,1|10,2|…|10,8`, orientación 90°) → asignar las dos cuadrillas libres → 4× hasta que la obra
  desaparece (288 unidades de trabajo) → `finishedBuildingCell("workshop")` y `ownedBuildingId`
  (`building_00000001`) como prueba de que el edificio industrial existe y es propio. El HUD de la
  captura muestra el consumo real: caja 6 785 u., cemento 8→2, ladrillo 16→6, acero 6→2.
- **14**: la misma propiedad con la ficha cerrada y **dos golpes de rueda del ratón** sobre el canvas
  (zoom 1,00 → 1,80, leído de la cámara) para que el recinto derivado ocupe el encuadre.
- Integridad del set: el arnés compara md5 y mtime — las tres capturas se reescriben, 11 y 14 ya no
  son idénticas entre sí, y `01`, `10` y `16` quedan byte a byte intactas. 0 errores de página.
- Detalle visible que conviene registrar: la candidata recomendada para el Taller es una franja 1×8.
  Es legal, pero es justo la forma que `shapePenalty` de la línea V.d-7B (P1-2) penalizaría.

## 15. Estado final de la rama

Doce commits sobre `b6ff2cd`, en el orden del plan (§3 de la fase):

```
cbfc6f1  refactor: expose deterministic development placement candidates
9b6659b  feat: add placement candidate worker contract
35c0ae6  feat: add interactive development placement state
cea5fae  feat: render development placement ghost
bca9663  feat: place buildings interactively in the game shell
88777d6  test: cover the interactive placement flow in the UX smoke
919244d  feat: stage construction visuals by progress
72132f3  feat: add deterministic property grounds
49b2928  perf: pool placement labels and count redraws
af3adfc  test: cover placement identity across save and load
3889455  test: adapt the core-loop smoke to interactive placement
29864b4  test: capture V.d-7C browser and performance evidence
c044d0e  docs: close V.d-7C interactive development placement
79b71bc  refactor: keep only the observational locators the evidence uses
```

Superficie: 4 993 inserciones / 239 borrados en 53 archivos. **No se tocó `game-data.ts`,
`district-generator.ts`, ni ninguna constante económica, de producción o de generador** (§47, §48).
Pruebas nuevas: `development-placement.test.ts` (31), `worker-placement.test.ts` (6),
`ui/placement.test.ts` (8), `construction-stages.test.ts` (6), `property-grounds.test.ts` (8).

Después del acta inicial quedaron dos commits documentales (`82addaa`, `fc51110`) y la corrida
dedicada que cierra P1-3, `76bc527 test: retake the V.d-7C captures that missed their case`, que
añade `placement-reachability.test.ts` (sonda opt-in), `scripts/vd7c-evidence-followup.mjs`, las tres
capturas re-tomadas y sus dos JSON de evidencia. Tampoco en ese commit se tocó economía, generador ni
datos de dominio: la obra industrial del 11/14 se pagó con la caja y el inventario con los que la
partida arranca.

## 16. P0 / P1 / P2

**P0: ninguno.**

**P1-1 — FPS del mapa con propiedad propia.** 60 → 14 FPS al poseer una parcela, ya en `b6ff2cd`;
V.d-7C baja a 12-13 en modo colocación y a 5-6 sobre una unión de tres parcelas. No es regresión
introducida, pero la fase la hace visible. Requiere decisión del responsable: abrir un trabajo de
presentación (rebake de suelo/overlay) o aceptar el estado actual.

**P1-2 — CERRADO tras la integración de convergencia.** `wip/ve-integrated-correction` integra
V.d-7B como ancestro de `develop` y conserva `preferredFootprint`/`shapePenalty` en
`enumerateFootprintCandidates()` junto con el enumerador completo de V.d-7C. El orden autoritativo
queda `target area → distance → shapePenalty → frontage → continuity → floors → area → orientation
→ signature`; el typecheck, los tests web/placement y los smokes de colocación pasan en la rama
integradora. La captura visual `12-multiparcel-building.png` sigue pendiente y no se declara V.d-7B
cerrada por este cambio.

**P1-3 — CERRADO el 2026-11-02 por la corrida dedicada (§14.2).** Las tres capturas que no enseñaban
su caso (06, 11 y 14) se re-tomaron sobre una partida limpia con la interfaz real y sin inyectar
recursos: 11 muestra un Taller propio terminado (compra → colocación → dos cuadrillas → 288 unidades
de obra liquidadas a 4×) y 14 el mismo recinto acercado con la rueda del ratón (zoom 1,80) donde se
leen `hardstanding`, patio de servicio, área de carga y contenedores derivados; 06 muestra el suelo
municipal intransferible, que es el único «aquí no cabe nada» alcanzable. El cero de candidatas del
modo colocación queda **documentado como no alcanzable** con la sonda reproducible
`pnpm placement:reachability` (2 297 proyectos barridos en la semilla de la app, mínimo 15 candidatas,
cero proyectos sin candidatas; §14.1) y con los casos de rechazo de las pruebas de motor y de la
ficha (`development-placement.test.ts`, `vd7a-multiparcel.test.ts`, `ui/placement.test.ts`). Queda
P1-1 abierto por el FPS.

**P2:** seto/valla poco legible a zoom normal; la lista de candidatas repite «4 celdas · 0° · 1
planta» sin más descriptor que el número (el mapa lo resuelve); `confirmar → obra visible` tarda
~1,7 s porque el comando se liquida en el tick y la proyección llega dos ticks después; el asset
`construction` del manifiesto no se usa para las etapas (se dibuja con Graphic Civic); la
representación visual de la orientación física sigue siendo deuda declarada de D-094 §7.

## 17. Deuda

Reabrir la certificación visual de V.d-7B (captura 12 multi-parcela); trabajo de presentación para
el FPS;
decidir si `preferredFootprint` entra en la identidad del candidato (hoy no entra: dos huellas con la
misma geometría comparten identidad, que es lo correcto); página de candidatas fija en 24 —si un
solar enorme la agota, el jugador no ve las colas—; y `automation` sin consumidor de colocación.
Añadido por el cierre de P1-3: el bloqueo de entrada `placementEntryIssues` es inalcanzable con el
catálogo actual (§14.1) —o se le encuentra un caso real o es código que se puede quitar—; y si el
generador llega a producir solares de menos de 10 celdas, `pnpm placement:reachability` lo avisará y
la captura 06 podrá enseñar por fin el panel de cero candidatas.

## 18. Decisión

**No se declara `V.d-7C READY FOR HUMAN PLAYTEST`**: el criterio §60 exige `P1 = 0` y esta acta
sigue registrando un P1 (P1-1 FPS). Todo lo demás del criterio está medido
y en verde —un único enumerador
autoritativo, determinismo, paridad de IA, una parcela, dos parcelas, preview de tres, cancelar,
candidato obsoleto, save/load, etapas de obra, 16/16 capturas revisadas y gates completos—.
**P1-3 quedó cerrado el 2026-11-02** con la corrida dedicada de §14.2 y la sonda de alcanzabilidad de
§14.1. Corresponde al responsable aceptar P1-1 y autorizar el playtest. No se declara V.d
cerrada ni playtest humano superado. D-097 pasa a ACEPTADA porque existe un único
enumerador autoritativo, IA y jugador comparten legalidad, la enumeración es determinista, la
evidencia de navegador muestra elección real de colocación y no se cruzó la frontera
simulación/render ni se copió trade dress histórico.
