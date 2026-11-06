# WP4.15-V.h — Auditoría visual preliminar y plan de corrección

**Fecha:** 2026-11-06  
**Rama:** `wip/vh-world-visual-foundation`  
**HEAD auditado:** `2ab9897807f18eb7cd4c74f25aca98616224fa38`  
**Estado:** `REWORK REQUIRED`

## 1. Resumen ejecutivo

La World Visual Foundation aporta una infraestructura válida —índice semántico, dressing de espacios públicos y parcelas, vehículos contextuales, actores Rocketbox, perfiles de distrito y captura automatizada—, pero la evidencia de píxeles demuestra que la integración final no alcanza el objetivo artístico.

El problema no está en la cantidad de assets disponible. Está en cuatro fallos de integración:

1. Gameplay sigue seleccionando edificios Blender heredados de las primeras fases (`bld_residential_*`, `bld_commercial_*`, `bld_shopfront`) para tipos de dominio distintos. Sólo el ayuntamiento nuevo está promovido como asset exacto.
2. Los vehículos sólo declaran/seleccionan azimuts 45° y 225°. Las carreteras `straight_ns` necesitan el eje visual perpendicular (135°/315° o una transformación equivalente), por lo que parte de los coches queda atravesada respecto a la calzada.
3. Los personajes se renderizan con una escala fija de `0.75`, sin relación con metros, tile size ni tamaño del frame. Los sprites Rocketbox de 256×256 resultan varias veces mayores que una persona a escala urbana.
4. El ayuntamiento promovido utiliza `vf_town_hall_1002` V7, cuya recipe declara `roof: flat_corniced`. La promoción no perdió bytes, pero sustituyó visualmente el ayuntamiento anterior con tejado inclinado por una silueta plana; por eso en gameplay se percibe que “ha perdido el tejado”.

Además, el gate 15/15 sólo garantiza que existe *algún* visual —muchas veces procedural—, no que se hayan creado y promovido 15 edificios Blender nuevos.

## 2. Hallazgos

### P0-01 — Catálogo antiguo todavía activo en gameplay

`BUILDING_VISUAL_POLICIES` asigna:

- `courtyard_home`, `row_house`, `apartment_block`, `mixed_tenement` → pool residencial heredado;
- `workshop` → pool comercial heredado.

Los pools contienen:

- `bld_residential_a/b/c`;
- `bld_shopfront`;
- `bld_commercial_b/c`;
- el `courtyard_home` Blender antiguo.

Consecuencia: distintos tipos de dominio comparten edificios antiguos 1×1 y pierden footprint, altura, función e identidad arquitectónica. El índice de 4.554 assets y las recipes nuevas no cambian lo que el jugador ve.

**Corrección:** desactivar estos archetypes heredados en gameplay. Cada `BuildingType` debe usar un asset exacto aprobado o su fallback procedural semántico exacto. Los assets heredados pueden permanecer en Art Lab, pero no en la ciudad.

### P0-02 — No existe catálogo runtime Blender 15/15

`runtime-assets-blender.json` contiene siete edificios heredados y un `town_hall` promovido. Los otros tipos dependen del bundle procedural.

El gate `BUILDING_VISUAL_COVERAGE` no debe confundirse con catálogo Blender nuevo.

**Corrección inmediata:**

- promover el candidato Composer curado `vg_courtyard_home_1002`;
- restaurar un ayuntamiento con tejado visible;
- usar fallback procedural exacto para los tipos todavía no aprobados;
- registrar una deuda explícita `BUILDING_RUNTIME_CATALOG = 2/15`, no 15/15 Blender.

La generación de nuevos binarios para los 13 tipos restantes requiere Blender y revisión visual; no se suplirá con assets semánticamente falsos.

### P0-03 — Orientación incorrecta de vehículos

`GameplayParkedVehicle.azimuth` sólo admite `45 | 225` y los planificadores asignan uno de esos dos valores tanto a `straight_ew` como a `straight_ns`.

En proyección isométrica, ambos ejes de carretera son diagonales diferentes. Un sprite del eje 45°/225° no puede representar el eje 135°/315° sin rotación o render adicional.

**Corrección:** introducir un contrato de orientación de pantalla:

- carretera EW → 45°/225°;
- carretera NS → 135°/315°;
- mientras el atlas no tenga 135°/315°, rotar en pantalla 90° el frame 45°/225°;
- añadir tests que comprueben paralelismo con el vector de la calzada.

### P0-04 — Escala de personas sin contrato físico

`IsometricSpikeScene` aplica `.setScale(0.75)` a cualquier actor.

Un frame Rocketbox mide 256×256; con escala 0,75 ocupa aproximadamente 192 px, cuando una persona de 1,75–1,85 m debería ocupar alrededor de 20–30 px con la retícula actual de 4 m/celda.

**Corrección:** calcular la escala desde una altura física declarada y el tamaño del frame:

`characterScale = gamePixelsPerMeter × actorHeightMeters / frame.height`

Añadir límites razonables y tests de proporción actor/vehículo/edificio.

### P0-05 — Regresión visual del tejado del ayuntamiento

La promoción actual apunta a:

- `vf_town_hall_1002` V7;
- `roof: flat_corniced`;
- footprint 8×4.

Existe una evidencia anterior `vf_town_hall_1000` V2 con:

- `roof: gable_dormers`;
- acceso monumental;
- footprint 4×3;
- pivote y metadata completos.

**Corrección:** promover el candidato con tejado inclinado como visual runtime del ayuntamiento, conservando la plaza cívica como dressing separado. Documentar la adaptación entre footprint artístico 4×3 y footprint de dominio actual 8×4.

### P1-01 — Estados de edificios heredados son imágenes idénticas

Varios assets Blender antiguos publican el mismo SHA para `complete`, `construction`, `damaged` y `burning`. Esto comunica estados falsos.

**Corrección:** no utilizarlos en gameplay. Los assets promovidos sólo declaran `complete` y usan `stateFallback: procedural` para los estados no generados.

### P1-02 — Captura industrial mal seleccionada

El manifiesto de captura usa `Corredor Ferroviario` —rol comercial— para `detail-industrial-20x.png`, mientras existen distritos `industrial_logistics` reales.

**Corrección:** escoger `Ensanche Ferroviario Oeste` o `Patios del Este` para detalle industrial y validar que el distrito de cada detalle coincide con la familia declarada.

### P1-03 — Evidencia duplicada bajo `apps/web/docs`

El último commit contiene seis capturas duplicadas en:

`apps/web/docs/art/world-visual-foundation/pixel-qa/`

Esto procede de una ejecución con cwd incorrecto y no debe permanecer como evidencia canónica.

**Corrección:** eliminar el directorio duplicado y endurecer el script de captura para resolver siempre rutas desde `REPO_ROOT`.

### P1-04 — No existe gate de escala visual

Los tests comprueban existencia, hash y determinismo, pero no relaciones físicas mínimas:

- persona frente a celda;
- persona frente a coche;
- coche frente a carril;
- edificio frente a footprint.

**Corrección:** añadir helpers puros y tests de escala/orientación. El gate debe fallar antes de generar 27 capturas absurdas.

### P1-05 — El QA de píxeles valida generación, no calidad

El script verifica page errors y hashes, pero no comprueba:

- que un building type no use un archetype heredado prohibido;
- que vehículos sean paralelos a la vía;
- que actores estén dentro del rango físico;
- que el ayuntamiento mantenga una silueta de tejado aprobada.

**Corrección:** añadir preflight assertions sobre el modelo visual y el manifiesto antes de capturar.

## 3. Plan de corrección

1. Congelar y documentar este baseline como `REWORK REQUIRED`.
2. Desactivar todos los archetypes heredados en gameplay.
3. Promover `vg_courtyard_home_1002` como segundo edificio Composer runtime.
4. Sustituir el town hall runtime por la variante con `gable_dormers`.
5. Introducir escala física de actores.
6. Introducir orientación de pantalla de vehículos para ambos ejes viales.
7. Añadir tests de política 15/15, escala y orientación.
8. Corregir captura industrial, paths duplicados y preflight del capture script.
9. Actualizar coverage/performance/documentación con métricas honestas.
10. Regenerar la evidencia sólo después de gates verdes.

## 4. Criterios de cierre

- Ningún edificio de gameplay usa `bld_residential_*`, `bld_commercial_*` o `bld_shopfront`.
- `courtyard_home` y `town_hall` usan candidatos Composer promovidos.
- Los otros 13 tipos usan fallback procedural exacto, nunca otra familia.
- Coche y carretera comparten eje visual.
- Actor humano dentro de escala física objetivo y menor que los vehículos/edificios.
- Ayuntamiento con tejado inclinado visible.
- Capturas industriales tomadas en un distrito industrial.
- Sin evidencia duplicada fuera de `docs/art/world-visual-foundation/pixel-qa`.
- Tests y typecheck verdes.

## 5. Estado preliminar

`WP4.15-V.h — VISUAL INTEGRATION REWORK IN PROGRESS`
