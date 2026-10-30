# V.d-UX — Inventario de la UI actual (UX-00)

Fecha: 2026-10-30. Base: `1bce442` (`develop`, merge de `19eae0c`).
Fuente: `apps/web/src/App.tsx` (1 912 líneas, 14 bloques), `styles.css`, `CityView.tsx`,
`isometric/IsometricSpikeScene.ts` y el contrato `ViewProjectionV2`.

Regla de este inventario: **ninguna superficie existente se queda sin destino**. O migra a HUD,
panel contextual, hub, notificación, ayuda u onboarding; o se reubica en modo debug; o se retira
con justificación. Ninguna capacidad se elimina (spec §5, §22.1).

## Tabla de migración

| # | Superficie actual (App.tsx) | Función | Destino UX | Acción necesaria | Riesgo |
|---|---|---|---|---|---|
| 1 | `topbar` → marca «Landlord · Distrito piloto» | identidad | HUD | HUD compacto; el distrito observado pasa a un control real (hoy es texto fijo) | bajo |
| 2 | `run-controls` → Pausar/Continuar, 1×/2×/4× | control de tiempo | HUD | se conserva; botones con icono+texto y `aria-pressed` | bajo (smoke usa «4×») |
| 3 | `run-controls` → Guardar / Cargar | persistencia | HUD | se conserva; «Guardar»/«Cargar» mantienen nombre accesible | bajo (smoke) |
| 4 | `run-controls` → «Abrir/Ocultar panel» | visibilidad del panel | se retira | el panel se abre por selección/hub y se cierra con ×/Escape; el botón deja de existir | medio (smoke no lo usa; sí cambia el flujo) |
| 5 | `run-controls` → enlace «Art Lab» | herramienta de arte | Debug | accesible sólo con `?debug=1` (o menú dev), no como acción del jugador | bajo |
| 6 | `map-header` → «Mapa operativo» + nombre de distrito | orientación | HUD + toolbar | el nombre del distrito vive en el HUD; el `hint` de cámara pasa a tooltip de ayuda | bajo |
| 7 | `map-header` → `<select>` de capa (14 opciones) | overlays | Toolbar visual | se sustituye por grupos con icono/leyenda (UX-09); mismo `MapOverlay` | medio (muchas capas, se agrupan) |
| 8 | `IsometricCanvas` | viewport | viewport | se conserva; se añade capa de indicadores de mundo (UX-05) | medio (Phaser) |
| 9 | `details` «Cómo jugar esta prueba» | onboarding textual | Onboarding / Ayuda | deja de ser la vía principal; el contenido pasa a `helpCatalog['first_steps']` y el onboarding progresivo guía | bajo |
| 10 | `CityView` (9 distritos) | navegación territorial | Hub «Ciudad» | panel permanente → popover/hub de ciudad; conserva `aria-label="Distritos"` y `role="gridcell"` | medio (smoke) |
| 11 | `details` «Equipamientos y espacios públicos» | programa municipal | GovernmentHub + FacilityPanel | la lista vive en Gobierno; cada facility se selecciona en el mapa y abre su panel | bajo |
| 12 | `status-line` (mensajes) | feedback | HUD | línea de estado compacta, no panel | bajo (smoke lee textos) |
| 13 | `metric-grid` (Caja, Calendario, Cemento, Ladrillo/acero, Cuadrilla, Influencia) | estado frecuente | HUD | chips con icono; «Caja» conserva `text-transform: uppercase` para lectores/smoke | bajo |
| 14 | `details` «Resumen financiero» (posición, mes, previsión, fiscalidad, mantenimiento, automatización, rutina, seguros, crisis) | economía | FinanceHub + GovernmentHub | posición/previsión/seguros/subastas → Finanzas; fiscalidad/mantenimiento/automatización → Gobierno; los ticks pasan a fechas | alto (muchos datos + ticks) |
| 15 | `details` «Excepciones y alertas» | alertas | NotificationCenter | campana con contador, categorías por `kind`, navegación por `targetId` | medio (contrato ya trae kind/targetId) |
| 16 | `details` «Comparador de cartera» | cartera | PortfolioHub | tarjetas por activo con nombre legible; deuda y seguros agrupados | bajo |
| 17 | `details` «Materiales y producción» (mercado + fábricas) | mercado/producción | ProductionPanel + BuildCatalog | precios y compra donde se deciden (compra de materiales y detalle de construcción); producción en el panel de la fábrica | medio |
| 18 | `details` «Financiación» (ofertas, aceptar, préstamos) | banca | FinanceHub | se mueve; garantía con nombre de parcela, no `parcel_id` | bajo |
| 19 | `section` «Inspección de parcela»: título, edificios de la parcela, aptitud, cargas, valor, regulación, mantenimiento | contexto de parcela/edificio | ParcelPanel / BuildingPanel | dos niveles (resumen/detalle), sin `permitStatus` crudo ni ticks | alto |
| 20 | «Inspección»: seguro (contratar/cancelar), subasta (pujar/retirar/refinanciar) | seguros/subastas | BuildingPanel + FinanceHub | contratación en el edificio; subastas en Finanzas | medio |
| 21 | «Inspección»: obra (progreso, cuadrillas, cancelar) | obra | ConstructionPanel | progreso en % + tiempo comprensible; cuadrillas «Cuadrilla N» | alto (smoke usa `crew_… · libre`) |
| 22 | «Inspección»: opciones de construcción (lista textual de botones) | construcción | BuildCatalog | tarjetas con miniatura, coste, materiales, estado y motivo de bloqueo | alto (smoke usa `.construction-option` y «Patio compacto») |
| 23 | «Inspección»: operación del activo (renta, ocupación, inquilinos, mejorar, reparar, técnico, ruina) | explotación | BuildingPanel | acciones agrupadas y condicionadas; perfiles traducidos | medio |
| 24 | «Inspección»: edificio rival (estado, integridad, sabotaje) | información rival | RivalPanel | sólo datos del sistema de información vigente; sabotaje si hay enforcer | bajo |
| 25 | «Inspección»: «Comprar parcela», «Promover ordenanza», «Proponer …», «Retirar propuesta» | acciones | ParcelPanel (comprar) + GovernmentHub (ordenanzas) | comprar queda en la parcela; política se va a Gobierno | medio (smoke usa «Comprar parcela») |
| 26 | «Inspección»: «Marcador técnico» (`?debug=1`) | debug | Debug | se conserva tras el flag | bajo |
| 27 | `section` «Riesgo y política»: ordenanza, opciones, heat, ruta ilegal, activos, servicios urbanos, municipio, empleo, vivienda, macro, contratos, reputación, inteligencia, rival | sistemas globales | GovernmentHub + FinanceHub + CityHub | se reparte por dominio; se traducen estados y se eliminan ticks | alto (bloque más denso) |
| 28 | `details` «Concejo municipal» | política | GovernmentHub | se mueve entero; calendario con fechas | bajo (smoke abre este summary) |
| 29 | `details` «Libro de caja reciente» | finanzas | FinanceHub | `tick` → fecha; causas ya traducidas | bajo |
| 30 | `details` «Diagnóstico de sesión» | debug | Debug | visible sólo con `?debug=1`; conserva IDs y ticks ahí | bajo |
| 31 | `ContractBidForm` (licitaciones) | contratos públicos | GovernmentHub | se mueve; validación ya existente | bajo |
| 32 | Helpers de etiquetas (`buildingLabel`, `zoningLabel`, `tenantProfileLabel`, `transactionLabel`, `resourceLabel`, `ordinanceStatusLabel`, `ownershipLabel`, `facilityLabel`, `publicSpaceLabel`) | vocabulario | `ui/labels.ts` | se centralizan y amplían (fechas, duración, crew, permiso, severidad) | bajo |
| 33 | `Metric` | presentación | `ui/hud/MetricChip` | se sustituye; conserva el texto «Caja» | bajo |
| 34 | Estilos `styles.css` (app-shell/topbar/workspace/sidebar/side-panel/…) | presentación | `styles.css` (tokens + shell) | se añaden design tokens y reglas del shell nuevo; se conservan las clases que usan otras superficies (ArtLab, VisualSlice, CityView) | medio |

## Selección → superficie (contrato de contexto)

| Selección | Superficie | Acción primaria |
|---|---|---|
| celda sin parcela | nada (panel cerrado) + HUD | — |
| parcela vacante | `ParcelPanel` | Comprar |
| parcela propia sin obra | `ParcelPanel` + `BuildCatalog` | Construir |
| edificio propio | `BuildingPanel` (pestañas: Resumen · Inquilinos · Mantenimiento · Seguro · Finanzas) | según estado |
| edificio rival | `RivalPanel` | sabotaje si procede |
| obra (propia o rival) | `ConstructionPanel` | asignar cuadrilla / cancelar |
| facility cívica | `FacilityPanel` | Ir al Ayuntamiento (si aplica) |
| Ayuntamiento | `GovernmentHub` | — |
| campana | `NotificationCenter` | navegar al target |
| botón Gobierno / Finanzas / Cartera / Ciudad | hub correspondiente | — |

## Capacidades que el shell debe conservar (no negociable)

- comprar parcela; solicitar/aceptar préstamos; refinanciar y pujar en subastas;
- contratar y cancelar seguros; asignar inquilinos; mejorar, reparar, enviar técnico y despejar ruinas;
- iniciar obra, asignar cuadrilla y cancelar obra;
- proponer/retirar/promover ordenanzas; pujar licitaciones; encargar inteligencia;
- cambiar política de mantenimiento y automatización; rutina de cartera;
- guardar/cargar/autosave; pausa y velocidad; cambiar distrito observado; overlays;
- Art Lab y diagnóstico (modo debug).

## Elementos con contrato de smoke vigente (`smoke:vd-core-loop`)

`.map-canvas canvas` · `section[aria-label="Inspección de parcela"]` · texto
«Worker conectado · simulación ejecutándose» · `[aria-label="Distritos"] [role="gridcell"]` ·
botón «Comprar parcela» · `.construction-option` con «Patio compacto» · botón `4×` ·
«Guardar» / «Cargar» · «Ocupar con …» · «Concejo municipal» · métrica «CAJA» (uppercase).
El paso de cuadrilla usaba `crew_00000001 · libre`: **se actualiza al nombre legible** porque
UX-07 prohíbe IDs técnicos en la UI del jugador. El paso de concejo pasa a abrir Gobierno.

## Riesgos del shell

1. `App.tsx` mezcla hoy estado de sesión, handlers de comando y presentación; el shell nuevo
   conserva los handlers en un único punto (`useGameSession`) para no duplicar reglas.
2. El panel flotante actual (`.sidebar`, 380 px, siempre abierto) debe convertirse en panel
   contextual cerrado por defecto; el mapa recupera el espacio y el smoke debe abrir contexto.
3. Los ticks visibles están en 12 sitios y los IDs en otros 12: se centralizan en `ui/labels.ts`
   con tests de regresión textual.
4. Las miniaturas deben salir del `RuntimeAssetManifestV2` (no de una colección nueva) y respetar
   la sustitución por Blender.
