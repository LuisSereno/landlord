# V.d-UX — Playable Interface, Contextual UX and Visual Vocabulary (acta)

Fecha: 2026-10-30. Rama: `develop`.

- **HEAD inicial:** `1bce442` (merge de `origin/develop` con la especificación V.d-UX, `19eae0c`).
  El preflight del plan pedía `19eae0c` como HEAD o ancestro: el árbol local venía de H2.1 y el
  remoto había avanzado con dos commits de documentación, así que se integró con un merge normal
  (sin rebase ni squash) y el conflicto de una línea en `docs/INDEX.md` se resolvió conservando
  ambas entradas. Nada ajeno se reescribió.
- **HEAD final:** el commit que contiene esta acta (no puede citar su propio SHA).
- **push:** no, según §0 y §25 del plan.

La especificación canónica es `docs/execution/phase-4/vd-ux-playable-interface-spec.md`; esta acta
registra qué se implementó, qué no, y con qué evidencia. **No la sustituye.**

## Qué se pidió y qué se entendió

Convertir la Alpha técnicamente jugable en una interfaz que un jugador pueda comprender y operar
sin conocer `GameState`. Tres ideas gobiernan el resultado:

1. **La ciudad es el producto**: viewport dominante, HUD compacto, panel contextual bajo demanda.
2. **Contexto antes que catálogo**: la selección decide qué se muestra y qué se puede hacer; los
   sistemas globales viven en hubs.
3. **El lenguaje de dominio nunca es el lenguaje de implementación**: ni ticks, ni IDs, ni enums,
   ni nombres de propiedades en la superficie del jugador.

No se añadió ninguna regla de simulación, edificio, banco físico, impuesto, tráfico ni misión
autoritativa. La simulación sigue siendo la única autoridad y la UI sólo envía comandos normales.

## Arquitectura entregada

`App.tsx` pasa de 1 912 líneas monólito a 539 de orquestación. La sesión (worker, proyección,
reloj, persistencia, mensajes, diagnóstico) vive en `apps/web/src/session/use-game-session.ts`; la
presentación se reparte en `apps/web/src/ui/` (15 ficheros, ~4 650 líneas con tests):

| Módulo | Responsabilidad |
|---|---|
| `ui/game-hud.tsx` | HUD compacto, toolbar de capas, campana, ayuda general, onboarding, diagnóstico (debug) |
| `ui/panels.tsx` | `ContextPanel` y paneles de parcela, edificio (con pestañas), obra, rival, equipamiento y espacio público |
| `ui/hubs.tsx` | `GovernmentHub`, `FinanceHub`, `PortfolioHub`, `CityHub` y el formulario de licitación |
| `ui/build-catalog.tsx` | catálogo visual por categorías, tarjetas y detalle con motivo de bloqueo |
| `ui/icons.tsx` | registro `UiIcon` (51 iconos), `ResourceIcon` |
| `ui/building-thumbnail.tsx` | miniatura derivada del `RuntimeAssetManifestV2` compartido con la escena |
| `ui/labels.ts` | fechas, duraciones, nombres de edificio/org/cuadrilla, estados traducidos |
| `ui/help.tsx` | `helpCatalog` único, `HelpTooltip` (hover + foco) y `HelpPopover` |
| `ui/notifications.ts` | derivación y saneado de alertas → notificaciones con destino |
| `ui/onboarding.ts` | siguiente paso derivado del estado |
| `ui/overlay-catalog.ts` | grupos, iconos, leyendas y colores compartidos con el renderer |
| `ui/disabled-reasons.ts` | explicación exacta de cada acción bloqueada con datos proyectados |
| `ui/types.ts` | alias del contrato de proyección y comandos que la UI puede enviar |

La escena isométrica gana tres operaciones de presentación —`setSelectedCell`, `focusCell` y una
capa de indicadores de mundo con pooling por firma— y el catálogo de capas deja de vivir en el
renderer para que la leyenda y los colores no puedan desviarse.

## UX-00 · inventario

`docs/execution/phase-4/vd-ux-ui-inventory.md`: 34 superficies de la UI anterior, cada una con
destino (HUD, panel contextual, hub, notificación, ayuda, onboarding o debug), acción necesaria y
riesgo; contrato selección→superficie; capacidades que el shell debía conservar; y los selectores
que usaba `smoke:vd-core-loop`, con las dos excepciones que cambiarían a propósito (nombre legible
de cuadrilla y concejo dentro de Gobierno). Commit `1df8d92`.

## UX-01 · shell jugable

HUD superior con marca, distrito observado (abre Ciudad), caja (abre Finanzas), fecha de juego,
materiales, cuadrilla, pausa, 1×/2×/4×, campana, ayuda, Guardar/Cargar y accesos Gobierno,
Finanzas y Cartera; línea de estado bajo el HUD. El mapa ocupa todo el resto. El panel contextual
se abre con la selección o un hub, mide `min(400px, 34vw)` (420 en ≥1800, 360 en ≤1366) y se cierra
con × o Escape. Art Lab y el diagnóstico quedan detrás de `?debug=1`, no como acción del jugador.
No queda ningún panel lateral permanente: `pnpm` smoke comprueba que `.sidebar` no existe.

## UX-02 · paneles contextuales

- **Parcela**: precio, disponibilidad, propietario, código, valor, riesgo y cargas; servicios
  potenciales si está vacía o reales si está construida; «Detalle urbanístico» plegable; Comprar
  si procede. Si es propia y vacía, el **catálogo de construcción va primero**.
- **Edificio propio**: miniatura real, nombre, estado, nivel, condición e integridad; pestañas
  Resumen · Inquilinos · Mantenimiento · Seguro · Finanzas; producción con ciclo, aptitud y
  ampliación cuando la instalación produce; acciones sólo si aplican.
- **Obra**: miniatura del tipo, qué se construye, progreso en % y trabajo restante en tiempo de
  juego, cuadrillas con nombre legible, inventario y cancelar.
- **Rival**: estado e integridad y sabotaje sólo si hay un enforcer libre; se muestra únicamente
  lo que el sistema de información expone.
- **Equipamiento / espacio público**: función, servicio, capacidad y utilización con la semántica de
  H2.1 (`serviceMetrics`), y acceso al Ayuntamiento. El suelo municipal ya no abre una ficha de
  «edificio rival».

## UX-03 · hubs

- **Gobierno**: ordenanza vigente y propuestas con sus efectos, fiscalidad con fecha de próxima
  liquidación, presupuesto municipal y niveles de servicio, servicios urbanos, concejo con partidos
  y ánimo, reputación y contratos públicos con puja.
- **Finanzas**: posición (caja, activos, pasivos, patrimonio), mes en curso y previsión, préstamos y
  ofertas, solicitud de préstamo con garantía de una parcela propia, subastas con pujar/retirar/
  refinanciar, y libro de caja con fechas de juego.
- **Cartera**: activos con ocupación, renta, condición y deuda de mantenimiento; seguros; política
  de mantenimiento y automatizaciones; rutina de cartera; excepciones.
- **Ciudad**: cuadrícula 3×3 de distritos, competencia con encargos de inteligencia, clima económico,
  empleo y mercado de vivienda.

No se creó ningún banco físico ni edificio nuevo.

## UX-04 · iconografía y vocabulario visual

- `UiIcon`: registro único con los 35 símbolos mínimos del spec más utilidades (51 en total), SVG
  internos 24×24, `currentColor`, trazo 1,8 y extremos redondeados; sin emojis ni dependencias.
- `ResourceIcon`: cemento (saco), ladrillo (hilada) y acero (viga), con nombre accesible y variante
  con etiqueta.
- `BuildingThumbnail`: lee el frame `complete` del mismo manifiesto que dibuja la escena, prefiere
  el asset de Blender cuando el tipo lo declara y cae al procedural. **15/15 tipos con miniatura
  verificada** (test).
- `BuildCatalog`: categorías derivadas del catálogo real (Vivienda, Comercio y mixto, Industria y
  logística, Producción), tarjeta con miniatura, coste, función y estado; detalle con materiales,
  producción o renta, usos, mejora, razones exactas de bloqueo y botón Construir.

## UX-05 · notificaciones e indicadores

- Campana con contador de no leídas; panel agrupado por Urgente/Finanzas/Propiedades…, con severidad,
  cuerpo saneado (los IDs del mensaje del motor se sustituyen por nombres o se retiran) y acción
  `Ver parcela` / `Abrir Finanzas`. Leído/no leído es estado local de presentación.
- Indicadores de mundo en Phaser: incendio/colapso, mantenimiento crítico y obra sin cuadrilla;
  máximo 12, ordenados por prioridad, reconstruidos sólo al cambiar su firma, ocultos en zoom < 0,7
  salvo los críticos; click navega a la entidad.

## UX-06 · ayuda y acciones bloqueadas

`helpCatalog` con 30 conceptos (rentabilidad, valor del suelo, aptitud, servicios, regulación,
influencia, permisos, mantenimiento, deuda, garantía, seguro, ordenanza, impuestos, presupuesto,
concejo, reputación, heat, ruta ilegal, inteligencia, clima, vivienda, empleo, contratos,
construcción, cuadrillas, capas, notificaciones, cartera, subasta, primeros pasos). `HelpTooltip`
accesible por hover y por foco de teclado; `HelpPopover` en los paneles complejos; y cada acción
deshabilitada enumera su causa con los números proyectados («Te faltan 2 ladrillos», «No tienes una
cuadrilla libre», «La parcela no permite este uso…»).

## UX-07 · lenguaje del jugador

Formateadores centrales: `formatGameDate` («17 de marzo»), `formatGameDuration` («8 días», «1 mes y
4 días»), `crewDisplayName` («Cuadrilla 2»), `organizationDisplayName`, `permitStatusLabel`,
`buildingStateLabel`, `loanStatusLabel`, `insuranceCoverageLabel`, `transactionLabel` (22 causas) y
un diccionario para los siete códigos urbanísticos. El calendario (`ticksPerDay`, `daysPerMonth`)
viaja en la proyección: React no copia constantes del motor. Cero ticks, IDs y enums en el flujo
normal; el diagnóstico técnico queda tras `?debug=1`.

## UX-08 · onboarding progresivo

`deriveOnboardingStep` propone un único paso según el estado: primera parcela (con «Mostrarme uno»),
primer proyecto, materiales que faltan con iconos y cantidades, cuadrilla, obra en marcha, ocupación,
y sólo cuando existe contexto, Finanzas o Gobierno. No crea misiones ni escribe en `GameState`; se
puede ocultar por paso.

## UX-09 · overlays

Toolbar visual agrupada (Propiedad · Valor · Uso · Servicios · Riesgo) con icono, etiqueta,
descripción y `aria-pressed`; opciones en menú por grupo; leyenda con los mismos colores que pinta
la escena; botón «Vista normal» que retira todo color semántico (la escena no dibuja contornos en
`none`). El `<select>` técnico desaparece. El overlay de servicios muestra cobertura **potencial**
en solares vacíos (su cobertura activa es 0 por diseño) y real en los construidos.

## UX-10 · responsive y accesibilidad

Verificado en 1280×720, 1440×900, 1920×1080 y con la misma estructura en ultrawide. Foco visible
global (`:focus-visible` de 3 px), `Escape` cierra en jerarquía ayuda → notificaciones → debug →
hub/panel, icon buttons con `aria-label`, `role="status"` en el estado, `role="progressbar"` en la
obra, paneles con `aside` + nombre accesible, `prefers-reduced-motion` respetado en CSS y en el
centrado de cámara, y ninguna información crítica depende sólo del color (los indicadores de mundo
combinan forma y texto; los estados llevan etiqueta).

## UX-11 · smoke y QA visual

`pnpm smoke:vd-ux` (`scripts/vd-ux-smoke.mjs`): 19 pasos en verde, 0 page errors, y genera las 13
capturas de `docs/art/golden/vd-ux/`. Las capturas se revisaron una a una; de esa revisión salieron
los ajustes del commit `e2c3741` (opacidad de paneles, jerarquía del panel de parcela, tarjetas a
una columna, subtítulos, plurales y overlay de servicios). Evidencia:

| Captura | Contenido |
|---|---|
| `01-normal-1440x900.jpg` | ciudad sin panel, HUD y toolbar |
| `02-parcela.jpg` | solar disponible con servicios potenciales |
| `03-catalogo-construccion.jpg` | catálogo por tarjetas dentro del solar propio |
| `04-detalle-produccion.jpg` | planta de cemento: materiales, producción, bloqueo |
| `05-residencial.jpg` | edificio propio con pestañas |
| `06-obra.jpg` | obra con progreso y cuadrillas |
| `07-gobierno.jpg` | hub de Gobierno |
| `08-finanzas.jpg` | hub de Finanzas |
| `09-notificaciones.jpg` | campana con aviso y acción |
| `10-ayuda.jpg` | ayuda general desde el catálogo |
| `11-overlay-servicios.jpg` | capa de seguridad con leyenda |
| `12-1280x720.jpg` | resolución mínima objetivo |
| `13-1920x1080.jpg` | resolución Full HD |

`smoke:alpha` y `smoke:vd-core-loop` siguen verdes tras adaptarlos al shell por hubs.

## Qué no se hizo (y por qué)

- **No se añadió ninguna regla de juego.** No hay banco físico, ni facilities nuevas, ni impuestos,
  ni ordenanzas, ni tráfico, ni población infantil, ni tutorial autoritativo, ni misiones en
  `GameState`. El onboarding es presentación y el estado leído/no leído vive en React.
- **No se reescribió el arte.** Las miniaturas son los assets existentes; no hay una colección
  nueva ni iconos dibujados a mano fuera del registro SVG.
- **No se implementaron vistas laterales ni mobile completo.** El objetivo es desktop; la UI se
  verificó a 1280, 1440, 1920 y ultrawide, y el layout colapsa a una columna sin romper a 1024.
- **No se tocó la simulación, la economía, el balance, las semillas ni `delegated_deferred`.**
- **No se cerró V.d.** El playtest humano sigue pendiente y lo cierra el responsable.

## Nuevos problemas detectados

**Ninguno P0 y ninguno P1** según el criterio de §27 (un P1 sería un problema que impide al
jugador completar el bucle o usar una capacidad existente). Clasificación razonada:

- **P2 — El mapa se selecciona sólo con puntero.** El shell cumple foco visible, Escape jerárquico,
  tooltips por teclado y nombres accesibles; la navegación por teclado de celdas isométricas no
  existe porque el picking es de Phaser. El objetivo de la fase es desktop con ratón y §17 de la
  especificación no exige navegación de rejilla: es deuda del renderer, declarada.
- **P2 — Cifras derivadas sin promesa de simulación.** «Rentabilidad» es `plazas ocupadas × renta
  efectiva − mantenimiento` y el tiempo de obra asume jornada completa; §6.5 pide una estimación
  «cuando sea posible», así que la cifra existe y está declarada en KNOWN-GAPS en vez de prometer
  una simulación temporal que el motor no tiene.
- **P2 — El tiempo de obra no descuenta la cuadrilla asignada.** La estimación es trabajo restante
  a jornada completa; con dos cuadrillas la obra termina antes de lo que dice la ficha.
- **P2 — La captura golden de valor de H1 ya no representa el pintado actual** desde H2.1-02 (los
  solares vacíos puntúan por potencial) y las de V.d-UX son referencia de QA, no pixel-diff.
- **P2 — `smoke:vd-ux` depende del hook `__landlordUiTest`** para localizar entidades; si se retira
  `?cameraTest=1`, el guion pierde esa vía y tendría que barrer el mapa.

## Deuda que sigue existiendo

1. Playtest humano de la fase (`PENDING HUMAN PLAYTEST`) con la checklist de §28 de la
   especificación: tiempos hasta entender/comprar/construir, errores de navegación, conceptos que
   piden ayuda, comprensión de iconos y materiales, respuesta a notificaciones, densidad percibida
   y tamaño útil del mapa.
2. P1 de escala municipal bajo desarrollo extremo, heredado de H2 y sin tocar.
3. `delegated_deferred` dominante (16/16), cold graph hitch y `mature p95` con instrumento
   ruidoso: sin cambios respecto a H2.1.
4. Guardados pre-H1 rechazados y capturas golden sin pixel-diff cross-environment.
5. Deuda de accesibilidad del mapa (P1 arriba) y del tiempo de obra (P2).
6. La integración con el remoto: `develop` local y remoto siguen divergidos desde `b750fb3`; esta
   fase no empuja.

## Incidencia del entorno (registrada)

A mitad de la fase, el ejecutor de `pnpm` 12.11.2 empezó a fallar cualquier spawn con
`Input/output error (os error 5)`, y más tarde lo mismo le ocurrió a `git` lanzado desde Node
(`spawnSync git EIO`). La causa raíz era el `PATH`: varias entradas apuntan a un SSD externo
desconectado (`/media/luis/CacheSSD/android-sdk/...`) y a un `/snap/bin` roto, y `execvp` devuelve
`EIO` al recorrerlas en vez de `ENOENT`. Con un `PATH` saneado (`/usr/bin`, `/bin`, Node y
`~/.local/bin`) `pnpm`, `git` y los scripts vuelven a funcionar.

Los gates se pasaron dos veces: primero invocando directamente los mismos binarios con las mismas
variables, y después con los comandos `pnpm` oficiales bajo el `PATH` limpio. Los números de esta
acta son los de la segunda pasada salvo donde se indica.

## Gates

| Gate | Resultado | Detalle |
|---|---|---|
| `pnpm lint` | PASS | 0 errores · 2 warnings `no-console` preexistentes en harnesses de evidencia |
| `pnpm typecheck` | PASS | `packages/shared`, `packages/simulation`, `apps/web` |
| `pnpm format:check` | PASS | todo el repositorio |
| `pnpm test` | PASS | shared 12 ficheros/50 tests · simulation 59+8 skip/491+14 skip · web 17/142 · arquitectura OK |
| `pnpm build` | PASS | `index` 2 078,21 kB (gzip 521,42) · CSS 25,75 kB (gzip 5,70) · worker de simulación 401,19 kB **sin cambio** |
| `pnpm smoke:alpha` | PASS | snapshot cargado · council «Concentración del Suelo Común» · caja 49 850 · 0 page errors |
| `pnpm smoke:vd-core-loop` | PASS | 15 pasos · 0 page errors (flujo de compra, obra, cuadrilla, guardado, distritos, suelo público, overlays y ordenanza) |
| `pnpm smoke:vd-ux` | PASS | 19 pasos · 0 page errors · 13 capturas |
| `pnpm art:assets:check` | PASS | manifiesto determinista · 108 imágenes · 153 880 bytes |
| `pnpm art:binaries:check` | PASS | 98 binarios · 24 768 304 bytes (las 13 capturas de V.d-UX suman ~1,57 MB) · bundle Blender 1 585 136 · 9 excepciones |
| `pnpm fabric:gate` | PASS | 100 seeds · 900 distritos · 73 289 parcelas · generación p50 147,65 / **p95 208,46** / max 388,37 ms (<300) · derivación vial p95 2,37 ms · evidencia `vd-ux-fabric-gate.json` (HEAD `33d7efd`) |
| `pnpm road:benchmark` | PASS | barrido 300 distritos · derivación **p95 2,34 ms** (≤25) · proyección jugable p95 14,47 · densa 85,56 · `structuredClone` jugable 6,52 / densa 26,38 |
| `pnpm system:cost` | PASS | 13/13 · cierre maduro media 38,41 · p50 38,82 · **p95 43,64** · max 43,94 ms · primer cierre p95 269,49 · tick ordinario p95 0,072 ms |
| `pnpm balance:playable` | PASS | 4 tests · 16 seeds · `delegated_deferred` 16/16 (señal preexistente, no tocada) |
| `pnpm soak` | PASS | 144 000 ticks en 86 263 ms · RSS final ~343 MB |
| `pnpm services:balance` | PASS | 12 seeds × 4 escenarios · bandas verdes · evidencia en `vd-ux-service-final.json` |

## Performance

La UI no toca la simulación: el worker baja idéntico (401,19 kB) y `system:cost` da **mature p95
43,64 ms**, por debajo del umbral de 60 ms y mejor que las cuatro corridas de H2.1 (51,12 · 61,76 ·
66,92 · 68,21) con el mismo código de simulación. La diferencia es del entorno: la batería se midió
con la máquina ociosa y sin servidores de preview, que era la causa del ruido de cola documentada
en H2.1.

Coste propio de la interfaz:

| Métrica | Antes de V.d-UX | Con V.d-UX | Delta |
|---|---|---|---|
| bundle principal | 2 016,15 kB · gzip 505,77 | 2 078,21 kB · gzip 521,42 | **+62,06 kB (+3,08 %)** |
| CSS | 12 648 bytes de fuente | 33 187 bytes de fuente · 25,75 kB construido | +20,5 kB de fuente |
| worker de simulación | 401,19 kB | 401,19 kB | 0 (la simulación no cambia) |
| nodos DOM | panel lateral permanente con 14 bloques | HUD fijo + panel contextual acotado + hasta 13 tarjetas | acotado por superficie; no hay un nodo por edificio |
| indicadores de mundo | — | máx. 12 objetos Phaser, pooling por firma | sin creación masiva |

Los thumbnails reutilizan las imágenes del manifiesto (data URIs ya cargadas por la escena) y no
añaden descargas. Los iconos son SVG de ~0,2 kB cada uno generados en el bundle.

## Git

| # | SHA | Mensaje |
|---:|---|---|
| 0 | `1bce442` | Merge remote-tracking branch 'origin/develop' into develop (integra la spec, HEAD inicial) |
| 1 | `1df8d92` | docs: inventory current alpha UI for V.d UX |
| 2 | `31224d2` | feat: add unified icon vocabulary and building thumbnails |
| 3 | `48f545d` | feat: add map overlay catalog and world indicators to the scene |
| 4 | `333de6f` | refactor: split the playable game shell from alpha inspector UI |
| 5 | `6792ae9` | test: adapt the core loop smoke to the playable shell |
| 6 | `e2c3741` | fix: polish the playable shell after visual review |
| 7 | `afa52fe` | test: adapt both alpha smokes to the hub-based shell |
| 8 | `33d7efd` | test: add V.d UX browser acceptance coverage |
| 9 | `aace646` | test: cover the UX contracts without a browser |
| 10 | — | docs: record V.d UX playable shell evidence (este commit) |

**push: no.** El plan recomendaba once commits; los bloques 1–2 (shell, paneles y hubs) se
agruparon en `333de6f` porque un shell no compila por mitades —App, paneles y hubs comparten tipos
y composición— y separarlos habría dejado commits que no construyen. El resto sigue la separación
recomendada, y cada commit posterior es verde.

## Estado

**`PASS WITH MANUAL PLAYTEST GATE`.**

Los once bloques UX-00…UX-11 están implementados según la especificación, los *acceptance criteria*
de §22 se han revisado uno a uno (shell sin panel permanente, 15/15 miniaturas, catálogo por
tarjetas, notificaciones con destino, ayuda desde catálogo central, cero ticks/IDs/enums, onboarding
contextual, resoluciones y accesibilidad) y los gates automáticos están en verde. **Cero P0 y cero P1** según §27; quedan cuatro P2
declarados arriba y en KNOWN-GAPS, ninguno de los cuales impide completar el bucle jugable.

**No se declara `V.d CLOSED`.** El cierre lo hará el responsable después de la sesión humana de
45–60 minutos descrita en §28 de la especificación; esta fase deja el producto y la evidencia
preparados para esa sesión.
