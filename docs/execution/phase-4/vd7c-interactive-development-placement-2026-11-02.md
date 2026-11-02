# V.d-7C — Colocación interactiva de proyectos y coreografía de obra (2026-11-02)

Estado: **implementación completa y gates en verde, NO declarable `READY FOR HUMAN PLAYTEST` según
§60 del prompt** porque `P1 ≠ 0` (ver §16). La decisión de aceptar los P1 y abrir el playtest
corresponde al responsable. No cierra V.d-7B, no cierra V.d y no sustituye el playtest humano de
`docs/execution/phase-4/vd-final-playtest-checklist.md`.

## 1. Git

| Punto | Valor |
|---|---|
| Documentación de la fase | `origin/docs/vd7c-interactive-development-placement@b6ff2cd` |
| Baseline funcional elegido | `b6ff2cd` (árbol de `974cc42` + los cuatro commits documentales de V.d-7C) |
| Rama de trabajo | `wip/vd7c-interactive-development-placement` |
| HEAD final | ver §15 |
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
| 06 | `06-no-placement.png` | **ISSUE** — el harness no produjo el caso: el archivo muestra el catálogo, no la explicación de «sin hueco». El estado de cero candidatas sí está probado por ocho tests de `development-placement.test.ts` y por la ficha del triplete de acería (blockers reales en 05) |
| 07 | `07-foundation.png` | PASS |
| 08 | `08-structure.png` | PASS |
| 09 | `09-finishing.png` | PASS |
| 10 | `10-complete-residential.png` | PASS |
| 11 | `11-complete-industrial.png` | **ISSUE** — muestra el distrito industrial con un solar vacío y su frente vial, no una propiedad industrial terminada: la partida del harness no llegó a terminar una nave y el distrito observado no tenía stock industrial edificado a la vista |
| 12 | `12-crew-on-site.png` | PASS |
| 13 | `13-residential-grounds.png` | PASS |
| 14 | `14-industrial-grounds.png` | **ISSUE** — mismo motivo que 11: sin propiedad industrial terminada no hay `hardstanding`/`service yard` que fotografiar. El vocabulario industrial sí está fijado por tests (`property-grounds.test.ts`) |
| 15 | `15-1280x720.png` | PASS |
| 16 | `16-1920x1080.png` | PASS |

Preguntas de la revisión: qué se construye, dónde, con qué orientación, qué suelo ocupa, dónde toca
la calle y cómo se cancela se leen en 01-05 y 15-16; la obra parece una obra en 07-09 (solera,
volumen parcial con andamio, acabado) y no un sprite con alpha; la propiedad terminada se lee como
recinto en 10 y 13 (jardín, seto y camino a la calle).

## 15. Estado final de la rama

Diez commits sobre `b6ff2cd`, en el orden del plan (§3 de la fase):

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
```

Superficie: 4 993 inserciones / 239 borrados en 53 archivos. **No se tocó `game-data.ts`,
`district-generator.ts`, ni ninguna constante económica, de producción o de generador** (§47, §48).
Pruebas nuevas: `development-placement.test.ts` (31), `worker-placement.test.ts` (6),
`ui/placement.test.ts` (8), `construction-stages.test.ts` (6), `property-grounds.test.ts` (8).

## 16. P0 / P1 / P2

**P0: ninguno.**

**P1-1 — FPS del mapa con propiedad propia.** 60 → 14 FPS al poseer una parcela, ya en `b6ff2cd`;
V.d-7C baja a 12-13 en modo colocación y a 5-6 sobre una unión de tres parcelas. No es regresión
introducida, pero la fase la hace visible. Requiere decisión del responsable: abrir un trabajo de
presentación (rebake de suelo/overlay) o aceptar el estado actual.

**P1-2 — V.d-7B sigue sin certificar y su línea no está integrada.** El baseline excluye
`0f323a4`/`a44ad67`/`f70f3bf`; `shapePenalty` cambiará el orden de candidatas cuando se integre, y
con él la paridad de §7 habrá que re-medirla.

**P1-3 — Tres de las dieciséis capturas no enseñan el caso que nombran** (06, 11 y 14, veredicto en
§14). Causa: el arnés de evidencia no encuentra en la partida real (a) un solar propio sin hueco
legal para ningún proyecto permitido, ni (b) una propiedad industrial terminada que fotografiar. Los
dos estados sí están fijados por pruebas deterministas de motor y de planificador de entornos, pero
la evidencia visual del paquete queda incompleta. Se cierra con una corrida dedicada (semilla con
stock industrial edificado o una obra industrial terminada por el camino largo) o aceptando el
hueco explícitamente.

**P2:** seto/valla poco legible a zoom normal; la lista de candidatas repite «4 celdas · 0° · 1
planta» sin más descriptor que el número (el mapa lo resuelve); `confirmar → obra visible` tarda
~1,7 s porque el comando se liquida en el tick y la proyección llega dos ticks después; el asset
`construction` del manifiesto no se usa para las etapas (se dibuja con Graphic Civic); la
representación visual de la orientación física sigue siendo deuda declarada de D-094 §7.

## 17. Deuda

Integrar la línea V.d-7B y re-medir la paridad diferencial con `shapePenalty`; reabrir la
certificación visual de V.d-7B (captura 12 multi-parcela); trabajo de presentación para el FPS;
decidir si `preferredFootprint` entra en la identidad del candidato (hoy no entra: dos huellas con la
misma geometría comparten identidad, que es lo correcto); página de candidatas fija en 24 —si un
solar enorme la agota, el jugador no ve las colas—; y `automation` sin consumidor de colocación.

## 18. Decisión

**No se declara `V.d-7C READY FOR HUMAN PLAYTEST`**: el criterio §60 exige `P1 = 0` y esta acta
registra tres P1. Todo lo demás del criterio está medido y en verde —un único enumerador
autoritativo, determinismo, paridad de IA, una parcela, dos parcelas, preview de tres, cancelar,
candidato obsoleto, save/load, etapas de obra, 16/16 capturas revisadas y gates completos—.
Corresponde al responsable aceptar P1-1/P1-2/P1-3 y autorizar el playtest, o pedir la corrida de
evidencia que cierre P1-3. No se declara V.d cerrada ni playtest humano superado. D-097 pasa a ACEPTADA porque existe un único
enumerador autoritativo, IA y jugador comparten legalidad, la enumeración es determinista, la
evidencia de navegador muestra elección real de colocación y no se cruzó la frontera
simulación/render ni se copió trade dress histórico.
