# D-095 — Interfaz jugable, paneles contextuales y vocabulario visual

Fecha: 2026-10-30. Estado: aceptada. Fase: V.d-UX.

## Contexto

V.d construyó una ciudad 3×3 con economía, producción, deuda, política, servicios espaciales y
presentación isométrica, pero la interfaz conservaba la forma de una herramienta interna de Alpha:
un panel lateral permanente que competía con la ciudad, sistemas heterogéneos visibles a la vez,
ticks e identificadores técnicos en la superficie del jugador, ninguna iconografía coherente, ni
miniaturas de lo que se puede construir, ni notificaciones conectadas con su origen. La
especificación `docs/execution/phase-4/vd-ux-playable-interface-spec.md` fija el contrato; esta
decisión registra las reglas permanentes que salen de ella.

## Decisiones

1. **La ciudad es el producto y la UI es soporte.** No existe panel lateral permanente. El
   viewport ocupa el resto de la pantalla; el panel contextual se abre con la selección o con un
   hub, se cierra con × o Escape y devuelve el espacio al mapa. Es presentación: no cambia ninguna
   regla ni el estado autoritativo.

2. **Contexto antes que catálogo; hubs para lo global.** La selección decide qué se muestra
   (parcela, edificio con pestañas, obra, rival, equipamiento, espacio público). Los sistemas
   globales viven en hubs: Gobierno (ordenanzas, fiscalidad, presupuesto, servicios, concejo,
   reputación, contratos), Finanzas (posición, préstamos, garantías, atrasos, refinanciación,
   subastas), Cartera (activos, rentas, condición, mantenimiento, deuda, seguro, excepciones) y
   Ciudad (distritos, competencia, clima, empleo, vivienda). **No se inventa un banco físico**: el
   hub se abre desde el HUD y desde el Ayuntamiento, no desde una entidad espacial que el motor no
   tiene.

3. **El shell consume la proyección existente y sólo la amplía con datos derivados.** La UI no lee
   `GameState` ni reimplementa elegibilidad. Se añadieron a la proyección dos campos de calendario
   (`ticksPerDay`, `daysPerMonth`) para traducir ticks a fechas sin copiar constantes del motor, y
   las razones de bloqueo se explican con los números que ya viajan (inventario, caja, cuadrillas,
   usos permitidos). El estado leído/no leído de las notificaciones es presentación local y no
   entra en `GameState`.

4. **El vocabulario de implementación no llega al jugador.** Prohibido mostrar ticks, IDs
   (`building_…`, `parcel_…`, `crew_…`, `org_…`), nombres de enums o de propiedades. Todo pasa por
   un catálogo central de etiquetas y formateadores que se prueba por texto. El diagnóstico técnico
   queda detrás de `?debug=1`.

5. **Iconografía y miniaturas derivan del contrato de assets.** `UiIcon` es un registro único de
   SVG internos 24×24 con `currentColor`; `BuildingThumbnail` lee el frame `complete` del
   `RuntimeAssetManifestV2` que dibuja la escena, con preferencia por el asset de Blender cuando el
   tipo lo declara. No hay una segunda colección de miniaturas ni SVG sueltos por componente.

6. **El catálogo de capas tiene una sola fuente.** `ui/overlay-catalog.ts` define grupos, iconos,
   etiquetas y leyendas, y la escena importa de ahí sus colores: la leyenda no puede desviarse de
   lo que se pinta. Se añade la capa `none` (vista normal) que retira todo color semántico.

7. **Los overlays de servicio muestran cobertura potencial en suelo vacío.** Un solar sin edificio
   tiene demanda activa 0 por H2-05, así que pintarlo «sin cobertura» era alarmante y falso; lo que
   el jugador necesita saber es si el servicio llegaría al construir (H2-10). Es presentación: no
   reserva capacidad ni altera `serviceCoverage` ni el land value.

8. **Las notificaciones son alertas derivadas, no eventos nuevos.** Se categorizan por `kind`, se
   sanean los IDs del mensaje del motor y se resuelven a un destino semántico (parcela o hub). El
   click navega; no ejecuta comandos. Los indicadores de mundo (incendio/colapso, mantenimiento
   crítico, obra sin cuadrilla) se limitan a doce, se agrupan por prioridad y se ocultan en zoom
   lejano salvo los críticos.

9. **El onboarding es una capa de presentación.** Propone el siguiente paso según el estado
   (parcela → proyecto → materiales → cuadrilla → obra → operación → finanzas/gobierno) sin crear
   misiones ni escribir en `GameState`.

## Consecuencias

- `App.tsx` deja de ser un monólito: 1 912 → 539 líneas, con la sesión en
  `session/use-game-session.ts` y la presentación en `ui/`. El estado de selección y de panel vive
  en el shell.
- Contratos nuevos cubiertos por tests: registro de iconos, catálogo de ayuda, etiquetas sin ticks
  ni IDs, miniaturas 15/15, razones de bloqueo, derivación y navegación de notificaciones, pasos de
  onboarding y objetivo de cámara/selección en la escena.
- La simulación no cambia: los tests de conservación y los gates de coste se mantienen.
- El playtest humano sigue pendiente; esta decisión no cierra V.d.
