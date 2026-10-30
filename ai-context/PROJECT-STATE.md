# Estado actual

Fecha de consolidación: 2026-10-29.

## Repositorio
- Inicializado.
- Documentación de producto: sí.
- Arquitectura propuesta: sí.
- WBS/EDT: sí.
- Plan maestro de ejecución por fases: sí.
- Plantilla de microtareas para agentes de baja ambigüedad: sí.
- Fase 0 de preparación: cerrada el 2026-10-20.
- ADRs D-046 a D-081: aceptados.
- Charter, contratos, benchmark y backlog inicial de Gate 1: listos.
- Historias del prototipo: sí.
- Riesgos: sí.
- Investigación histórica: sí.
- Investigación avanzada de dirección artística y pipeline: sí.
- Art Bible / Art Pipeline v0.1: documentadas como propuesta de preproducción; no ratificadas como ADR.
- Visual Direction Spike: cerrado el 2026-10-23; baseline `graphic_civic` aprobada, con Art Lab y
  provenance en `docs/execution/phase-2/wp2-14-visual-direction-spike-2026-10-23.md`.
- Blender 5.2.2 LTS: instalado localmente y fijado como toolchain artístico inicial (D-053).
- Librería bootstrap CC0: descargada localmente; aún no versionada en Git.
- Staging artístico local: organizado por fuentes CC0 verificadas, cuarentena de
  licencia/origen pendiente y toolchain; manifests con hashes/provenance y
  validador local disponibles. Los binarios siguen ignorados hasta decidir LFS.
- Estrategia artística self-contained / coste ~0 para Gate 2: decidida (D-054).
- Building Factory / Character Factory: concepto documentado; no implementado.
- Wiki para IA: sí.
- Capa funcional fiscal/urbana: documentada conceptualmente.
- Visión multiperspectiva y trayectoria vital: documentada conceptualmente.
- Modelo de identidad/roles/capabilities: documentado como restricción arquitectónica futura.

## Sistemas: implementado frente a conceptual

### Implementado (código autoritativo y pruebas)

- impuestos y tasas (propiedad, transmisión, tasa de servicios);
- presupuesto municipal con prioridad de gasto y niveles de servicio;
- permisos con identidad propia y ciclo de vida completo (emitir → publicar → consumir o vencer),
  zoning y compatibilidad de usos decididos por una sola regla (D-093);
- seguros, mantenimiento, banca, subastas e insolvencia;
- contratos públicos con licitación, fianza y ejecución;
- servicios urbanos que recorren la red por grafo de viaje, con la cobertura ligada al edificio físico
  del equipamiento y limpieza radial por distrito (D-092/D-093);
- identidad espacial `districtId + cell` y huella de edificio autoritativa para obstáculos,
  adyacencia e interacción táctica con requisito de camino real (D-093);
- empleo agregado y capacidad de alquiler;
- reputación por tres grupos con memoria y decaimiento;
- información imperfecta con expediente de estimaciones;
- IA rival con perfiles de facción, postura y memoria antirrepetición;
- concejo municipal electo, opinión por cinco ejes y transferencia presupuestaria;
- macroeventos económicos acotados con trigger propio, efectos cableados, señales y reacción de IA;
- automatización delegada de propiedad, finanzas y mantenimiento con los mismos comandos y permisos,
  y bandeja de excepciones priorizada.
- topología vial autoritativa determinista en `GameState.map.roads`, persistida como segmentos y
  proyectada como `digest + cells`; render Graphic Civic de gameplay desde esas celdas con precedencia
  road > apron > parcela > suelo base (WP4.15-V.c.2B/C, D-085).

### Parcialmente implementado

- representación visual del distrito (WP4.15-V): V.c.1, V.c.2B/C y V.c.3A/B/C están cerradas.
  Gameplay consume exclusivamente `ViewProjectionV1.map.roads.cells`; `/visual-slice` conserva su
  topología autoral como fixture independiente. V.c.2D (acceso/edificabilidad como regla de producto)
  sigue diferida; tampoco hay selección de distrito en la UI;
- commuting: el empleo sigue siendo agregado, sin trayectos por agente;
- planificador de la IA: no existe; sólo cadenas inmediatas tras un `dispatch`;
- expediente de inteligencia de las facciones: diferido;
- instrumentación persistente de sesiones de Alpha (D-063): **parcialmente cerrada el 2026-10-28**.
  Existe un playtest instrumentado real de 30 minutos a 4× con informe versionado
  (`docs/execution/phase-4/playtest-30min-2026-10-28.md`) y sus P0 corregidos en `95804ee`; faltan
  cohortes con n > 1 y persistencia en producto, que quedan bajo la excepción propuesta D-087.

### Conceptual / futuro

- múltiples roles y perspectivas política/criminal/inversora/ciudadana jugables;
- historial de carrera y Career Events;
- life simulation, herencia y dinastías.

## Implementación
- Código jugable: sí, baseline vertical coherente de Gate 2 más los sistemas Alpha de WP4.3–WP4.11.
- package.json: sí, raíz y workspaces mínimos de Gate 1.
- CI: sí, checks base en GitHub Actions; desde WP4.11-H incluye lint, typecheck, tests, build,
  format y los smokes de Gate 2 y Alpha.
- assets: runtime procedural generado y versionado como data URIs (92 frames, 11 tipos de edificio,
  manifiesto `RuntimeAssetManifestV2` de 146,6 KB bajo el budget de 200 KB); no hay binarios de arte
  final ni Blender ejecutado en CI.
- backend: no.
- modelo de datos implementado: contratos shared v1 extendidos de forma aditiva, núcleo autoritativo
  headless de Gate 2, producción física localizada, proyección financiera derivada y distrito
  generado por perfil/seed con identidad de generación persistida (D-064).
- tests: sí, smokes Chromium en CI, contratos, schemas, referencias de snapshot hasta WP4.11,
  arquitectura de fronteras, bucle económico determinista con superficie canónica completa,
  generación y jugabilidad de distritos con fixtures de hash, digestos dorados de conservación del
  tick, mercado de vivienda segmentado con índice de renta, mercado laboral agregado conectado a la
  asequibilidad, presupuesto municipal con recortes, servicios urbanos sobre la red con disponibilidad
  ligada al edificio, doce city seeds canónicas, contratos con fianza, reputación con atribución,
  información imperfecta, los cinco escenarios de aceptación cross-district de V.d-H1, una campaña
  instrumentada de 24 meses con hitos y un escenario transversal de Fase 4 con save/load.

## Fase
Gate 1 aprobado `GO` el 2026-10-21; la evidencia técnica de G1-RW-01..04 quedó reunida.
Gate 2 en `GO` para producción representativa desde el 2026-10-23: el responsable confirmó la
prueba manual OK, WP2.15 está cerrado, el benchmark/smoke pasan y WP2.14 aprobó `graphic_civic`.

## Próximo objetivo

Fase 0 de V.d ejecutada el 2026-10-28
(`docs/execution/phase-4/fase-0-vd-baseline-2026-10-28.md`). Baseline medido en esta sesión, no
heredado: lint, typecheck, tests, build, smoke Alpha, benchmark, coste por sistema, benchmark vial y
balance jugable en verde, con el cierre mensual de 800 parcelas aún fuera del presupuesto p95 de
D-065 (p95 maduro 40,5 ms) y `pre-vd-baseline` etiquetado. El smoke Alpha **estaba rojo en `95804ee`**
por una aserción que codificaba 260 en vez de la puja por defecto del 92 %; corregido.

**Fase 0 de V.d quedó cerrada el 2026-10-28.** El corpus morfológico está entregado:
`tools/urban-benchmark` trabaja sobre extractos regionales de Geofabrik (Merseyside, Greater
Manchester, País Vasco, Pennsylvania), así que no depende de la API pública de Overpass; 28/28
ventanas, 0 degeneradas, con SHA-256 de los cuatro extractos y atribución ODbL en
`docs/urban-benchmark/provenance-v1.json`. Sólo se versionan agregados: ni geometría OSM ni los
`.pbf` descargados entran en el repositorio, y una guarda en `check-architecture` impide que el
runtime importe la herramienta. El responsable aprobó los envelopes y ratificó D-087…D-092 en lo que
reflejan el plan, autorizando explícitamente `SnapshotV2` sin compatibilidad con saves v1.

**V.d.0 está cerrada el 2026-10-28** (`docs/execution/phase-4/vd0-ciudad-multidistrito-2026-10-28.md`).
`GameState` vive sobre un `WorldState` con ciudad, doce gateways y nueve distritos; `SnapshotV2` y el
protocolo v2 son los únicos aceptados y un guardado v1 se rechaza por nombre, se lista como
incompatible y sólo se borra a petición. Los agentes y las estructuras técnicas llevan `districtId`,
el trabajo exige presencia en el distrito del objetivo y `TransferCrew`/`TransferAgent` mueven gente
por el grafo de ciudad con duración determinista y sin coste monetario. La proyección es
`ViewProjectionV2`: distrito observado, resumen público de los nueve y mapa/parcelas/edificios sólo
del observado, con la caja intacta al cambiar de vista. React ofrece la cuadrícula 3×3 y el smoke
Alpha la recorre. El gate está verde en sus seis criterios con evidencia en tests.

Consecuencias registradas: los perfiles de facción convergen porque el rival opera en un solo
distrito (vuelve en V.d.2), la opinión municipal se satura con ocho distritos sin stock (V.d.2 la
pondera por población efectiva) y `centro_civico` necesitó tolerancias más anchas para no romper la
generación. El coste del cierre mensual con nueve distritos es el riesgo abierto número uno y se
mide antes de V.d.1.

**V.d.1 está cerrada el 2026-10-28**
(`docs/execution/phase-4/vd1-red-vial-manzanas-parcelacion-2026-10-28.md`, código `0418a5d`). La
parcela deja de ser un punto: el generador traza la red desde `RoadAnchor[]`, forma manzanas por flood
fill, las parte con callejones deterministas si exceden el envelope y subdivide por frentes con BFS
multi-fuente. `RoadTopology` mantiene `topologyVersion: 1` y sube `derivationVersion` a 2; `Parcel`
gana `blockId`, `cells`, `anchorCell`, `roadFrontages` y `disposition`, y el snapshot persiste
manzanas y reservas públicas. Evidencia del gate: 100 city seeds / 900 distritos, 81.266 parcelas, 0
fallos; generación p95 169,86 ms (< 300), derivación vial p95 2,83 ms (≤ 25) y cada receta dentro de
su envelope morfológico (`docs/execution/phase-4/vd1-fabric-gate.json`). El cierre mensual maduro
sube a p95 34,62 ms y sigue fuera del presupuesto de D-065: V.d.2 debe introducir los índices
derivados y re-medir. Los saves v2 anteriores a V.d.1 se rechazan por nombre y no se migran.

**V.d.2 está cerrada el 2026-10-28**
(`docs/execution/phase-4/vd2-composicion-urbana-2026-10-28.md`). `Parcel` deja de tener `zoning` y
`buildingId`: cada parcela lleva un `DevelopmentCode` y sus `currentUses`; cada edificio y obra lleva
distrito, huella autocolocada, orientación, plantas y forma. Una parcela admite varios edificios
terminados pero una sola obra activa. Los índices de edificios por parcela, por distrito, huellas y
parcelas por bloque se reconstruyen y no se persisten. Vivienda y empleo tienen mercado/puestos por
distrito con fallback de ciudad, la elección pondera población efectiva, las facciones miden manzanas
y frentes compartidos y la automatización no traslada agentes: deja una excepción. El ciclo
comprar → permiso → construir → ocupar → cobrar está verde en los nueve distritos; los saves v2
anteriores se rechazan por nombre. El cierre mensual sigue en p95 ~34,3 ms y es deuda de rendimiento
para V.d.3/V.d.4.

**V.d.3 está cerrada el 2026-10-29**
(`docs/execution/phase-4/vd3-ciudad-civica-2026-10-29.md`). La ciudad nace con el programa municipal
exacto de §4.4: 14 equipamientos (ayuntamiento, 3 escuelas, 3 clínicas, 2 comisarías, 2 parques de
bomberos y 3 mercados), 7 espacios públicos (1 plaza y 6 parques), 14 parcelas públicas y 14
edificios municipales. El generador reserva manzanas enteras antes de subdividir, exige frente vial y
falla el intento si el programa no cabe; las parcelas públicas son intransferibles, no admiten
garantía ni obra empresarial y los espacios públicos son reservas reales, no decoración. La
proyección y el inspector muestran función, capacidad, operador, edificios, parcelas y celdas de
acceso para la cobertura futura. El barrido de 900 distritos sigue verde (73.289 parcelas, generación
p95 169,54 ms, red p95 2,65 ms) con techos de mezcla ajustados a la baja tras medir los máximos
reales. La cobertura por grafo, la saturación de capacidad y el mantenimiento municipal quedan como
deuda de V.d.5.

**V.d.4 está cerrada el 2026-10-29**
(`docs/execution/phase-4/vd4-densidad-skyline-valor-2026-10-29.md`). `Parcel` separa
`baseLandValue` y `marketValue`: el score entero del suelo combina centralidad, comercio, amenidades,
frente, código, servicios, industria, aislamiento y seed, el valor se mueve como máximo un 5 % por
cierre y compras/garantías/impuestos/balance leen el mercado. El bloque de viviendas sube a cinco
plantas y el ensayo `corridor_density_trial` permite +1 planta y +100 FAR en corredores; el permiso
congela el derecho adquirido y su expiración no invalida activos. La autocolocación prefiere frente
principal y continuidad, y el inspector/overlay publican el desglose. Gates: valor reproducible y
sumado, bandas distintas, servicios mueven el valor, 64 campañas jugables sin dominancia, 900
distritos con generación p95 221,58 ms y cierre mensual maduro p95 50,35 ms (deuda de rendimiento
para V.d.5).

**V.d.5 está cerrada el 2026-10-29**
(`docs/execution/phase-4/vd5-servicios-espaciales-2026-10-29.md`). La cobertura de equipamientos se
calcula sobre un grafo de celdas viales con avenidas coste 1, calles 2 y gateways con el coste del
perfil; la demanda se asigna a la facility alcanzable de menor coste, la capacidad se satura y el
nivel presupuestario multiplica la capacidad efectiva. Seguridad y transporte dejan de ser radiales;
bomberos reduce la progresión del fuego y salud acorta la recuperación con helpers únicos;
educación, mercado y parques alimentan vivienda y valor. La proyección publica cobertura por parcela,
saturación por facility y overlays de servicios. 376 tests de simulación verdes, cierre maduro p95
43,30 ms y 64 campañas jugables sin dominancia. El arranque frío del grafo (~312 ms una vez) queda
como deuda de carga para V.d.6.

**V.d.6 está cerrada el 2026-10-29**
(`docs/execution/phase-4/vd6-presentacion-dressing-2026-10-29.md`). El adapter pinta parcelas
multi-cell y resuelve picking por cualquier celda a un único `ParcelId`; la factoría añade seis
formas cívicas originales y el manifiesto V1 queda en 145 KB. La capa de mapa incorpora uso, código
urbanístico y rol urbano, y seis capturas golden documentan centro cívico, HUD oculto, residencial,
industria, valor y densidad. Web 92 tests, build y smoke verdes. Queda como deuda de Beta el
`RuntimeAssetManifestV2` con orientaciones de edificios asimétricos y huella de dominio explícita.

**V.d-H1 (hardening de integridad urbana) está ejecutada el 2026-10-29, pero V.d NO está cerrada**
(`docs/execution/phase-4/vd-h1-urban-integrity-hardening-2026-10-29.md`, D-093). Sobre `95e8937` se
corrigen los diez hallazgos que dejó el salto de un distrito a la ciudad 3×3 —H1-01 identidad espacial
por distrito, H1-02 huella autoritativa, H1-03 contrato de permiso, H1-04 compatibilidad de usos,
H1-05 disponibilidad ligada al edificio, H1-06 limpieza por distrito, H1-07 selección multi-edificio
en UI, H1-08 ocupación visual sobre `geometryCells`, H1-09 valor del suelo con servicios y densidad
vigentes, H1-10 aceptación de extremo a extremo—, cada uno con su test de regresión verificado contra
el código previo. Se añaden además las doce city seeds canónicas (§2.1), la campaña instrumentada de
24 meses con hitos (§2.2), el smoke del núcleo en navegador (§2.3) y `RuntimeAssetManifestV2` (§3, que
cierra la deuda que V.d.6 declaró arriba).

Los diez digestos dorados se regeneran cuatro veces, siempre atribuidos por medida y sin tocar seeds,
constantes económicas ni límites morfológicos. Los gates de §4 quedan verdes y mejoran el baseline:
generación p95 198,24 ms, red p95 2,27 ms, cierre maduro p50 35,41 ms, soak estable. **Lo que impide
cerrar la fase:** no se ha jugado la partida humana de §2.4
(`docs/execution/phase-4/vd-final-playtest-checklist.md`, `PENDING HUMAN PLAYTEST`) —el smoke
automatizado no lo sustituye—, y quedan dos hallazgos de balance medidos y no parcheados: 100 de ~709
parcelas comercializables con cobertura de seguridad con 12 de 14 equipamientos saturados, y
`delegated_deferred` ganando en 16/16 seeds, comportamiento reproducido idéntico en `95e8937`, es
decir preexistente a H1.

**V.d-H2 (cierre de presentación y servicios municipales) está ejecutada el 2026-10-30, pero V.d
sigue sin cerrarse** (`docs/execution/phase-4/vd-h2-presentation-service-closure-2026-10-30.md`,
D-094, con aclaración documental en D-093 §7 por H2-11). Sobre `3f3c707` se cierran las tres
inconsistencias que H1 dejó latentes y una reconciliación documental: (a) la proyección y el
renderer representan ahora el footprint físico real de cada edificio y obra (H2-01), con
`ViewProjectionV2.economy.buildings[]` publicando `districtId`, `footprintCells`, `orientation`,
`floors` y `form`, y con el scene recorriendo las colecciones directamente en lugar de resolver
por `parcel.buildingId === building.id`; (b) la demanda de servicios municipales sigue el
desarrollo urbano, no el censo catastral (H2-05), la asignación es greedy determinista
capacity-aware (H2-06), la capacidad se calibra por servicio (H2-07) sobre las doce seeds
canónicas y los cuatro escenarios 25/50/75 % (H2-08), la respuesta al presupuesto modula
unidades no cohortes (H2-09) y las parcelas vacantes exponen servicio potencial sin reservar
slot (H2-10); y (c) el bundle procedural cubre los 15 tipos de dominio (H2-02), `row_house`,
`apartment_block`, `mixed_tenement` y `warehouse` tienen silueta propia y un test estructural
derivado de `BUILDING_DEFINITIONS` lo fuerza. `Building.orientation` (física) y
`allowedOrientations` (azimut) quedan explícitamente separados, sin conectar hasta que exista
arte lateral: deuda visual P2 declarada (H2-03). Un solo digesto dorado cambia, atribuido en H2-05
(Voronoi sobre 200 desarroladas vs 716 marketables); H2-06…H2-10 conservan los diez bit a bit.

**V.d-H2.1 (corrección posterior a la auditoría de H2) está ejecutada el 2026-10-30 sobre
`b750fb3`; V.d sigue sin cerrarse.** Cuatro puntos, ningún feature nuevo: (H2.1-01) el informe de
facilities dejaba de mezclar magnitudes — `demand` era cuenca Voronoi y `served` capacidad
consumida con spill-in, y el tercer campo `coveragePercent = served/demand` no era una cobertura
(podía superar el 100 con spill-in y el Zod del renderer lo acotaba, así que la proyección se
rechazaba o se truncaba); publica `firstChoiceDemand` / `effectiveCapacity` / `served` /
`utilizationPercent` (0..100 contra la capacidad) y `saturated` significa «sin hueco libre», no
«la cuenca es mayor que el cupo»: una facility apagada ya no se confunde con una saturada. La
proyección llama al bloque `serviceMetrics` y el inspector web enuncia las cuatro cifras.
(H2.1-02) los solares **vacantes** se tasan por cobertura potencial y los desarrollados por la
real, sin tocar la demanda activa (sigue en 0 para vacantes), sin nuevos pesos en
`transport + security + cleaning`, sin reservar hueco y sin mover `civicAmenities`; cambia un
digesto dorado (`city:200-parcels:month-boundary`) atribuido revirtiendo sólo esa línea —los diez
recuperan su valor— y con diff hoja a hoja: 90 diferencias, todas `marketValue` de parcelas sin
edificio privado, cero en las 157 desarrolladas, en las cinco cajas y en el resto de observables.
(H2.1-03) la evidencia de balance etiquetaba `capacityUnitParcels` con el scalar global 25; pasa a
`demandUnitsPerCapacityFor(service)` (75/75/25/17/25) y la corrida nueva se guarda en
`docs/execution/phase-4/vd-h21-service-final.json` sin pisar la evidencia de H2 — ninguna capacidad
se tocó para cambiar la evidencia —. (H2.1-04) el acta de H2 decía «push: no» y «HEAD final:
c7a6281»: se registra el estado real — H2 se empujó a `origin/develop` (`3f3c707..b750fb3`) tras
autorización explícita, el HEAD de cierre de la fase es `b750fb3` (un acta no puede contener su
propio SHA) y durante H2.1 el remoto avanzó dos commits de documentación propios, así que
**`develop` local y remoto están divergidos desde `b750fb3`**; la integración es decisión del
responsable y esta fase no empuja nada.

**Rendimiento de H2.1 — el disparador de 60 ms queda sin resolver.** Cuatro corridas de
`system:cost` sobre los árboles de H2.1 dan `mature p95` 51,12 · 61,76 · 66,92 · 68,21 ms (mediana
64,34). La regla del plan («si mature p95 ≥ 60 ms, estado final BLOCKED») se incumple en 3 de 4
corridas; el mismo disparador ya se incumplió en la segunda corrida archivada de H2 (63,85 ms) con
el acta registrando 55,61 ms del mismo código, porque el `p95` del harness se calcula sobre 24
muestras maduras y equivale a la segunda muestra mayor. La tendencia central no empeoró (media
44,92-47,99 · p50 40,47-46,61 frente a 48,17/46,13 de H2) y la única obra nueva dentro del cierre
está medida y optimizada de forma exacta y neutra (`074aaa2`: 0,73 → 0,46 ms por cierre, ~1 %; los
diez digestos dorados sin cambio). **No se abrió un refactor de rendimiento para recuperar los
44 ms de H1: el plan lo prohíbe y no hay regresión demostrable.** Estado literal de la fase según
§5: `BLOCKED` por rendimiento hasta que el responsable decida cómo se mide ese umbral.

**V.d-UX (interfaz jugable, UX contextual y vocabulario visual) está ejecutada el 2026-10-30
sobre `1bce442`; V.d sigue sin cerrarse.** La especificación
`docs/execution/phase-4/vd-ux-playable-interface-spec.md` se implementa en su integridad
(acta `vd-ux-playable-interface-2026-10-30.md`, D-095): `App.tsx` pasa de 1 912 a 539 líneas con
la sesión en `session/use-game-session.ts` y quince módulos en `ui/`; el panel lateral permanente
desaparece (HUD compacto + viewport dominante + panel contextual que abre la selección o un hub y
cierra con ×/Escape); paneles por entidad (parcela con catálogo primero si está vacía, edificio con
pestañas, obra, rival, equipamiento) y hubs Gobierno/Finanzas/Cartera/Ciudad sin inventar banco
físico; registro `UiIcon` de 51 símbolos SVG internos, iconos de material y `BuildingThumbnail`
15/15 derivada del `RuntimeAssetManifestV2` que dibuja la escena; catálogo de construcción por
tarjetas con motivo exacto de bloqueo; campana con categorías, severidad y navegación al origen, e
indicadores de mundo en Phaser (12 máximo, pooling por firma, ocultos en zoom lejano salvo los
críticos); ayuda contextual desde un `helpCatalog` único; lenguaje sin ticks, IDs ni enums
(calendario en la proyección, formateadores centrales); onboarding derivado del estado; toolbar de
overlays con leyenda y vista normal, y el overlay de servicios pinta cobertura potencial en solares
vacíos. `pnpm smoke:vd-ux` (19 pasos) genera y valida 13 capturas revisadas una a una; `smoke:alpha`
y `smoke:vd-core-loop` siguen verdes tras adaptarse a los hubs. **No se añadió ninguna regla de
simulación** y los gates de coste y conservación se mantienen.

**Incidencia del entorno registrada:** a mitad de la batería de gates el ejecutor de `pnpm`
12.11.2 comenzó a fallar todo spawn con `Input/output error (os error 5)`. Causa raíz encontrada
en V.d-UX: hay entradas de `PATH` en un SSD externo desconectado (`/media/luis/CacheSSD/...`) y una
`/snap/bin` rota; al recorrer el `PATH`, `execvp` devuelve `EIO` en vez de `ENOENT`. Con un `PATH`
saneado vuelven a funcionar tanto `pnpm` como `git` lanzado desde Node. Los gates se repitieron dos
veces: por invocación directa de los mismos binarios, y con los comandos `pnpm` oficiales bajo el
`PATH` limpio; ambos registros están en el acta de V.d-UX.

**Lo que impide cerrar la fase sigue siendo el playtest humano de §2.4** más el hallazgo P1 de
escala municipal bajo desarrollo extremo: con la banda nueva el 75 % de desarrollo da
55 % de cobertura en security, fire, health y market y 56 % en education —tensión real dentro de
la banda 45-80 %—. Subir ese techo exigiría decisiones de producto (más facilities, cohortes
más grandes) que D-094 no autoriza. `delegated_deferred` dominante, cold graph hitch, snapshots
pre-H1, arte final cívico y la representación visual de la orientación física siguen como deuda
declarada.

WP4.15-V.c.2C-H y V.c.3A/B/C están cerrados: lint, contratos, harnesses, documentación y el 404 de
favicon quedan corregidos; las T e intersecciones publicadas reciben pasos de peatones discretos,
derivados de la máscara vial real; el dressing estático añade farolas, semáforos sólo en
intersecciones completas, bancos, papeleras y vehículos aparcados deterministas. No reabrir el
derivador ni la arquitectura vial: `ROAD_TOPOLOGY_CORE = PASS` y `GRAPHIC_CIVIC_ROADS = PASS`.

Fase 3 cerrada con `GO CONTROLLED ALPHA`. Bajo la excepción D-063 (2026-10-23) el responsable
adelanta la producción de contenido de Fase 4 sin la medición de sesiones reales que exigía
WP3.15; la instrumentación persistente de cohortes/seed queda diferida y debe ejecutarse antes
del cierre de Alpha (WP4.16). La prueba manual del responsable se conserva como evidencia
cualitativa; la medición cuantitativa de 30–60 minutos sigue pendiente para balance financiero.
Los WPs de Fase 4 se ejecutan incrementalmente con plan y checks por WP. WP4.1 (distritos y
generación reproducible) quedó cerrado el 2026-10-23 bajo D-064: perfiles data-driven, anclas
autoradas, expansión procedural, jugabilidad validada, fixtures con hash e inspector de seeds.
WP4.2 (Simulation LOD) quedó cerrado el 2026-10-23 bajo D-065: sistemas del tick nombrados y
medibles, harness de coste por sistema y escala, diez digestos dorados de conservación, crecimiento
sublineal de barrio a ciudad (exponente 0,74 en la media) y LOD agregado documentado pero latente,
porque ningún sistema excede los umbrales en la ciudad máxima que permite el mapa de 64×64.
WP4.3 (oferta y demanda de vivienda) quedó cerrado el 2026-10-23 bajo D-066: demanda segmentada,
deseabilidad por parcela, vacancia y movilidad, índice de renta descubierto por vacancia y acotado,
y conservación observable de toda la evidencia económica anterior.
WP4.4 (empleo y actividad económica) quedó cerrado el 2026-10-23 bajo D-067: mercado laboral
agregado con puestos por planta operativa, índice salarial acotado y propagado al ingreso por
segmento y al presupuesto de renta de los hogares de mercado.
WP4.5 (presupuesto municipal) quedó cerrado el 2026-10-23 bajo D-068: el municipio paga con su caja
real en orden de prioridad, registra descubierto y niveles de servicio, y el recorte reduce la
deseabilidad del barrio.
WP4.6 (servicios urbanos y accesibilidad) quedó cerrado el 2026-10-23 bajo D-069 con el overlay de
mapa diferido a WP4.15: tres servicios con cobertura radial, radio que se satura al crecer, efectos
en accesibilidad, seguridad y calidad, y tasa por unidad ocupada.
WP4.7 (contratos públicos) quedó cerrado el 2026-10-23 bajo D-070: el municipio licita por calendario,
adjudica al menor postor con fianza del 10 % que se conserva, ejecuta con reintento si la tesorería no
alcanza y deja contadores de cumplimiento; la IA rival compite con el mismo comando.
WP4.8 (reputación multidimensional) quedó cerrado el 2026-10-24 bajo D-071: tres grupos con efecto
propio —vecinos, gobierno y banca— valoran de forma opuesta el mismo hecho, la memoria es de 16 hechos
acotados por organización y sólo decae la opinión.
WP4.9 (información imperfecta) quedó cerrado el 2026-10-24 bajo D-072: los accesos público, propio,
inferido y privado se declaran en un registro central, el expediente pertenece a un observador y las
estimaciones se compran con caja, con error declarado y precisión que envejece; ningún digesto dorado se
mueve porque el ruido sale de un arroyo de PRNG separado.
WP4.10 (IA estratégica y facciones) quedó cerrado el 2026-10-24 bajo D-073: dos perfiles con objetivos,
umbrales y puja propios —el conservador reproduce los números históricos, así que la comparación entre
campañas es medible—, posturas que sólo nacen de encuentros reales (sabotaje, desbanco, licitación competida y
roce territorial con la trama a una o dos celdas), memoria de doce acciones en ventana de tres meses y
antirrepetición que escala de −60 al segundo rechazo a salir del menú al tercero. La campaña headless cambió el
diseño: sólo penalizar dejaba al rival con 101 acciones fallidas en doce meses; con la supresión cierra con 12
y 190 ciclos cortados. Ninguna postura ni perfil sale hacia la proyección y siete observables privados del
jugador no mueven la decisión del rival.
WP4.11 (política y elecciones iniciales) quedó cerrado el 2026-10-24 bajo D-074: concejo ficticio de nueve
escaños con legislatura de seis meses y debate dos meses después, cinco ejes de opinión (vivienda, empleo,
seguridad, servicios, impuestos) calculados cada mes desde subsistemas que ya existían y saliencia por segmento
como dato. La transferencia institucional es triple y sobre reglas existentes: el partido que gobierna decide el
orden de recorte del presupuesto, el concejo intenta imponer su propia ordenanza —posponiendo el debate si otra
ley ocupa la mesa, para no borrar nunca una decisión comprada por la jugadora— y su alineamiento modula ±25 puntos
la probabilidad del `LobbyPolicy`. Son tres plataformas exclusivamente datos y ningún candidato, con nomenclatura
ficticia vigilada por prueba. La aceptación está medida: en la campaña de dos años el gobierno alterna con el
estado social (Liga → Suelo Común → Liga → Suelo Común) y con 0 y 50 de influencia la participación, los escaños y
el gobernante salen idénticos; el sistema no mueve ni un saldo. `politics` es el primer agregado de Fase 4 que
entra en `canonicalizeState`, lo que obliga a regenerar los diez digestos dorados —verificado: ocho recuperan su
valor de WP4.10 quitando el bloque y los dos cruces de mes lo recuperan neutralizando la transferencia—.
**WP4.11-H (hardening de sistemas Alpha) quedó cerrado el 2026-10-25 bajo D-075**, antes de WP4.12. Paga la
deuda transversal de WP4.2–WP4.11: el censo electoral sólo admite residentes efectivos (available y
displaced no votan), la tasa de servicios entra en el ánimo fiscal mediante el mismo helper puro que la
cobra (sin doble cobro), `canonicalizeState` cubre los once agregados que faltaban con orden estable y
save/load produce la misma cadena, las referencias de contratos/reputación/inteligencia/facciones se
validan al restaurar, el benchmark mensual mide de verdad el cierre, `lastReason`/`lastAction` del rival
salen de la proyección, la oferta pública y el encargo de inteligencia son jugables de punta a punta, la UI
municipal usa las cuatro categorías reales y muestra el concejo, una ley activa no se re-sortea y la
duración de ordenanzas es única. Los diez digestos se regeneraron con atribución: la serialización
canónica anterior sobre los mismos estados recupera exactamente los diez valores de WP4.11. El cierre
mensual de 800 parcelas domina el coste y cruza el presupuesto p95 de D-065; LOD no se
implementa y la optimización de vivienda queda como deuda medida.
**WP4.11-H.1 (follow-up de corrección) quedó cerrado el 2026-10-25 bajo D-076** sobre el baseline
auditado `83cc25a`, antes de WP4.12 y sin añadir gameplay: `WithdrawPolicy` sólo retira propuestas porque
la ley activa es municipal y caduca sola; el sabotaje no detectado deja de manchar al atacante
(`publiclyAttributedOrganizationId` manda para la reputación, `causedByOrganizationId` es verdad del
motor); el snapshot valida el *tipo* de organización en los roles de empresa; `canonicalizeState` suelta
`clock.runState` y `clock.speed` y guardar corriendo a 4x carga canónicamente igual; los tests de
canonicalización mutan entidades reales; el panel de hacienda muestra la tasa prevista
(`serviceFeeDueNextSettlement`) en vez del acumulado que siempre vale 0; y D-065 se reescribe —cruzar el
disparador de 5 ms abre remediación obligatoria (medir, optimizar exacto, y sólo después LOD)— con el
cierre medido como distribución, hoy sobre 8 layouts × 3 posiciones sintéticas del reloj (p50 ~28 ms,
máximo ~38 ms frente a un tick ordinario de p95 ~0,08 ms; `housing` concentra ~69 %). **Esa distribución
es PROVISIONAL**: no es una campaña longitudinal, así que las muestras de mes 2 y 3 no han vivido el
cierre anterior y llegan sin historia de préstamos, buscadores ni stock acumulado. D-071, el acta de WP4.8
y el resumen de Fase 4 quedan anotados como parcialmente obsoletos donde aún prometían `banks +1` por
desalojo, con la tabla vigente apuntando a `REPUTATION_POLICY.facts`. Antes de WP4.13: (1) reescribir
`measureMonthlyCloses` como campaña longitudinal por semilla, (2) volver a medir, (3) optimizar
`placeSearchers` (`runHousingMarket`) exacto, (4) re-medir, y sólo si sigue fuera, LOD. WP4.12 no debe
añadir trabajo nuevo al cierre sin volver a medir, ahora entendido como "medir longitudinalmente".
**WP4.12 (macroeventos económicos) quedó cerrado el 2026-10-25 bajo D-077** tras reapertura por
auditoría: seis tipos (escasez de materiales, recesión, migración, boom constructivo, crisis de
vivienda, falta de mano de obra) con duración en meses del juego, cota de un evento por tipo (máximo
seis) y modifiers aditivos escalados por intensidad. Trigger mensual determinista con PRNG propio
derivado de la seed y decorrelacionado del económico; el arroyo vive en el snapshot y en el estado
canónico. Los seis modifiers tienen consumidor central: materiales (mercado, arranque de obra y
proyección), renta (`askingRentFor`), demanda y señal de vacancia del mercado de vivienda, deriva
salarial y esfuerzo de obra —nunca un coste en caja artificial—. La IA rival sesga su utilidad por
familia de objetivos con información pública; la proyección publica eventos, intensidad, ventana y
modifiers agregados. Persistencia aditiva con derivación desde la seed para partidas anteriores y diez
digestos regenerados con atribución de superficie. Benchmark longitudinal con A/B
`natural | none | representative | max`, desglose mes 1 / meses 2-3 / maduros 4+ y muestra por cierre
con su carga. El siguiente es la optimización de `placeSearchers` y después WP4.13 (Gameplay LOD y
delegación).
**La optimización exacta de `placeSearchers` quedó hecha el 2026-10-25** (acta
`docs/execution/phase-4/place-searchers-optimization-2026-10-25.md`): los diez digestos no cambian, la
mediana del cierre de vivienda baja de 19,40 a 18,15 ms y la cola del cierre completo mejora hasta un
25 % en los escenarios cargados, pero la media apenas se mueve porque `buildStock` (O(edificios²))
domina el cierre con 17,6 ms de mediana por sí solo. Ese es el siguiente candidato exacto antes de
evaluar LOD.
**WP4.13 (automatización, delegación y LOD mínimo) quedó cerrado el 2026-10-25 bajo D-078**: gestores
diarios de propiedad, finanzas y mantenimiento que emiten los mismos comandos y permisos que la
jugadora (`AssignTenant`, `RequestLoan`+`AcceptLoanOffer`, `RepairBuilding`+`AssignCrewToWorkOrder`),
acotados por día; bandeja priorizada sobre el canal `alerts` existente, ampliado con seguros;
`automation.routineTaskCount` y desglose interno por tipo. Medición en 50/200/800 parcelas: 6/28/121
interacciones manuales frente a 0 del jugador con gestor. Sin LOD nuevo (la deuda de `buildStock`
sigue abierta) y sin `ControlContext` (no hay consumidor). Los diez digestos se regeneran por
superficie. El siguiente es WP4.14 (herramientas internas y balance).
**WP4.14 (herramientas internas y balance) quedó cerrado el 2026-10-25 bajo D-079**: `measureBalance`
(quiebras, vacancia y movilidad, concentración con cuota y HHI, deuda, presupuesto y fila por
organización), `detectInvariantViolations` (cajas, inventarios, tenencia, referencias, préstamos,
automatización, macroeventos y servicios), validador permanente de catálogos, inspector de estado
opt-in (`pnpm state:inspect`) y campaña de balance con seeds registradas
(`pnpm balance:campaign`, 8 semillas × 12 meses × 200 parcelas × 4 estrategias) versionada en
`docs/balance/alpha-baseline-v1.json` y validada por test. Hallazgo: la delegación con mantenimiento
diferido gana caja a la pasiva en 8/8 semillas y elimina la vacancia medida; el mantenimiento
equilibrado queda dominado en caja (31,84 % de vacancia frente a 3,13 %, más coste), registrado como
bandera de balance para tuning posterior, no como invariante rota. El siguiente es WP4.15 (pipeline
artístico y escalado de contenido).
**Revisión del 2026-10-25 (auditoría externa de WP4.14)**: ese dataset **no era una baseline de balance
de gameplay**. La campaña construía el mundo con `createScaledCity`, un arnés de carga que inyecta
5 000 000 de caja y regala parcelas, edificios, inquilinos, préstamos y cuadrillas; con esa caja
`financeCashFloor` no se activa nunca y las cajas finales quedan en 4,8–5,0 millones frente a los 12 000
de la partida real. Se renombra a `docs/balance/synthetic-city-balance-v1.json`
(`worldKind: "synthetic_load_harness"`, conservado como test de esfuerzo) y se añade la baseline jugable
`docs/balance/playable-alpha-baseline-v1.json` (`pnpm balance:playable`): `createInitialState(seed)`,
16 semillas × 12 meses × 4 estrategias ejecutadas **sólo con comandos reales** del jugador, políticas
por `SetMaintenancePolicy`/`SetAutomationPolicy`, rutina de crecimiento idéntica para las cuatro,
`commandAudit` por tipo y determinismo verificado; 62-68 s. Con datos jugables **ninguna estrategia
domina** (ganadoras por semilla: `passive` 8, `delegated_deferred` 5, `maintained` 2,
`delegated_balanced` 1; comparaciones 6/16, 4/16 y 3/16) y el "mantenimiento equilibrado dominado"
queda rebajado a **señal fuerte para investigar**: pierde caja en 12 de 16 semillas pero termina con más
suelo, más edificios y más valor de catálogo. `scripts/build-balance-dataset.mjs` genera los dos
datasets y `balance-dataset.test.ts` valida los dos archivos.
**WP4.15 (pipeline artístico y escalado de contenido) quedó cerrado el 2026-10-25 bajo D-080**:
contrato runtime de assets v1 en shared (edificios con huella, pivote y cuatro estados; personajes con
4/8 direcciones e `idle`/`walk`; hashes y provenance), factoría procedural determinista con 68 SVG en
data URIs (manifiesto de 106 KB, sin binarios ni LFS), integración de edificios en Phaser con pivote y
depth desde metadatos, galería y animación de personajes en el Art Lab, validación de esquema/hashes/
budgets en CI, captura visual con baseline SHA-256 y perfil de 400 sprites a 60 FPS DOM. El arte final
Blender conserva el mismo contrato; la integración de personajes en la escena jugable y el atlas
raster quedan diferidos con decisión registrada. Los smokes de juego siguen verdes con sprites y sus
cajas no se mueven.
**WP4.15-H (endurecimiento pre-cierre, auditoría del 2026-10-25) quedó cerrado el 2026-10-25 bajo
D-081**, sin deshacer commits: `effectiveConstructionWorkRequired` unifica el esfuerzo de obra entre
`StartConstruction` y la proyección; el test de carga de WP4.13 mide diez días reales tras la
maduración; `buildStock` pasa de O(edificios²) a índice espacial de buckets exacto (17,6 → 2,70 ms de
mediana, digestos intactos) y el cierre mensual baja a 15,5–18,9 ms de media según modo macro, aún
fuera del presupuesto p95 y sin hotspot único; la huella participa en depth y posición
(`depthForAsset`/`footprintCenter`) y cada dirección camina con sus propios frames
(`animationFrameFor`); la ruta Blender queda demostrada de extremo a extremo para un edificio y una
variante de personaje (`tools/art-pipeline/blender/runtime_asset.py` +
`scripts/build-blender-assets.mjs`, bundle verificado por `art:blender:check` y consumido por Phaser);
atlas/texture packing y Git LFS se reclasifican como requisitos de Beta con criterio de reapertura
medido y presupuesto de binarios con guarda en CI (`art:binaries:check`); el perfil denso se mide en
Phaser de verdad (400 sprites, cambio de frame y scroll, 60 FPS de mediana) y la regresión visual se
conserva local-only por la inestabilidad del pixel-diff cross-environment; CI usa smoke estructural,
integridad Blender y presupuesto de binarios. Acta en
`docs/execution/phase-4/wp4-15-hardening-2026-10-25.md`.
**WP4.15-H.1 (cámara y Art Lab QA) está implementado el 2026-10-26 bajo D-082 y verificado localmente**: picking mediante la transformación de cámara de Phaser, pan escalado por zoom, zoom anclado al cursor, manifest Blender importable en `src/generated` (PNG en `public`), Art Lab como Asset QA y regresión browser integrada en el smoke Alpha. La simulación no cambia; WP4.16 sigue cerrado hasta completar la verificación CI remota.
**WP4.16 (robustez y cierre alpha) sigue en NO-GO hasta esta revisión y ahora tiene su precondición de
`buildStock` cumplida**; la decisión de LOD agregado con su benchmark posterior forma parte de su
alcance, junto al playtest instrumentado diferido por D-063.

El baseline económico actual cubre calendario
económico (30 minutos reales = un mes a 1×), mercado frente a producción propia, dos cuadrillas
asignables, edificios multiunidad, presupuesto y satisfacción de inquilinos, mantenimiento, rival
público con datos privados ocultos, licitación pública con fianza, reputación por grupos con hechos
registrados, expediente de inteligencia con estimaciones, facciones con memoria y relaciones, concejo municipal
electo que recorta el presupuesto y legisla solo, política
incierta y riesgo con cooldown y conservación de dinero.

El desglose operativo se encuentra en `docs/execution/`. El núcleo determinista, Worker,
snapshot v1, IndexedDB, escena/picking, flujo vertical, benchmark y soak headless están
cerrados. El retest browser carga 500 agentes y 100 estructuras en Worker y Phaser, mide
comandos/backlog/proyección/save-load y cubre 10 minutos a 10 Hz en Firefox y Chromium. Ambos
cumplen los umbrales. Gate 2 queda habilitado. D-055 resuelve el punto `events`/snapshots: los
eventos normales son efímeros, mientras que la memoria histórica se materializará en registros
específicos cuando una regla lo necesite.

El baseline ya valida en código y smoke de navegador: render isométrico/picking, Worker,
tick fijo, seed/PRNG, determinismo, save/load y el primer flujo de producto. Debe seguir midiendo
en sesiones de 30–60 minutos que el ritmo y los trade-offs son comprensibles y sostenibles; la
primera confirmación manual fue OK, pero no incluyó registro cuantitativo.
El HUD incluye un diagnóstico efímero de comandos, transporte y métricas del Worker para que
los playtests puedan identificar rechazos repetidos sin persistir datos no autoritativos.
La comprobación manual básica de esa instrumentación quedó cerrada sin errores ni rechazos;
no reemplaza la validación de producto de Gate 2 ni demuestra todavía agentes funcionales.
La captura de la implementación anterior confirmó una vista técnica. WP2.11 usa una base
map-céntrica con panel operativo superpuesto/plegable, HUD jerarquizado, inspector contextual y
estados legibles; está lista para servir de pantalla representativa a WP2.14 según D-058.

El rework de auditoría quedó implementado bajo D-060. La suite automatizada cubre 100 pruebas,
además de tres benchmarks opt-in; el smoke de producción recorre materiales, producción, compra,
obra, asignación de dos cuadrillas, ocupación, mejora, política, save, reload real, load, rival y
ruta ilegal. Esto cierra la preparación técnica del playtest, no su evidencia humana prolongada.

## Restricciones arquitectónicas que Gate 1 debe respetar

Aunque no implemente multiperspectiva:
- evitar player == company;
- comandos con actor explícito cuando proceda;
- ownership independiente del control;
- organizaciones independientes;
- no hardcodear playerIsMayor/playerIsCriminal;
- no asumir información universal.

## Scope Gate 1

Incluido:
- mapa mínimo;
- cámara;
- interacción;
- simulation core;
- persistencia técnica;
- profiling.

Excluido:
- fiscalidad avanzada;
- banca;
- seguros;
- playable politician;
- playable criminal;
- citizen life simulation;
- ageing/family/dynasty;
- elections;
- multiplayer;
- LLM;
- mundo procedural amplio;
- backend complejo;
- contenido masivo.

## Pregunta de éxito
¿Puede una simulación determinista, desacoplada del render y no acoplada a una única organización del jugador, ejecutarse en navegador con rendimiento suficiente para escalar al prototipo?
